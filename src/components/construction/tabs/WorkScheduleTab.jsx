import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarDays, ChevronDown, ChevronRight, ClipboardList, Expand,
  FileSpreadsheet, Image as ImageIcon, Link2, Lock, Minimize2, Minus, Plus,
  RotateCcw, Trash2, Wand2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AutoScheduleDialog from '@/components/construction/AutoScheduleDialog';
import { constructionService } from '@/api/services/construction';
import { cn } from '@/lib/utils';
import { EmptyNote, Segmented } from '@/components/shared/DashboardKit';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import { getApiErrorMessage } from '@/utils/apiError';

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

const WEEKDAYS = {
  uz: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
};

// Zoom presets → px per day.
const ZOOMS = { day: 44, week: 16, month: 6 };

const RAIL_W = 360;     // fixed left rail
const NAME_W = 206;     // Ish column (code + name)
const DAYS_W = 42;      // Kunlar column
const DATE_W = 56;      // Boshlanish / Tugash columns
const ROW_H = 40;
const TICK_H = 26;      // day/week tick row height
const MONTH_H = 20;     // month band height
const RESIZE_ZONE = 10; // px from the right edge that acts as a resize handle
const OVERSCAN = 10;    // windowing overscan rows
const MAX_RANGE_DAYS = 750;

const isScheduled = (w) => Boolean(w?.sched_start && w?.sched_end);

// Ish grafigi — Gectaro-style Gantt over smeta work items. Rows are the
// project's estimate works grouped by section; bars are drag-movable
// (whole bar) and resizable (right edge). Dropping PUTs the new dates;
// the server FS-propagates successors and returns every shifted row so
// local state stays exact. One Undo step restores the whole batch.
export default function WorkScheduleTab({ project, onOpenSmeta }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canUpdate } = usePermissions();
  const canEdit = canUpdate(MODULES.CONSTRUCTION);

  const [works, setWorks] = useState(null); // null = not loaded yet
  const [deps, setDeps] = useState([]);
  const [projInfo, setProjInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [zoom, setZoom] = useState('day');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDepId, setSelectedDepId] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [freezing, setFreezing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  // Bar drag: { id, mode: 'move'|'resize', startClientX, deltaDays }.
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  // Dependency drag-connect: { fromId, x1, y1, x, y } in timeline coords.
  const [depDrag, setDepDrag] = useState(null);
  const depDragRef = useRef(null);

  // Windowing.
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(560);
  const scrollerRef = useRef(null);
  const overlayRef = useRef(null);
  const rootRef = useRef(null);

  // Footer panel inputs.
  const [progressInput, setProgressInput] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [depPredId, setDepPredId] = useState('');
  const [depLag, setDepLag] = useState('0');

  // Blok filtri — 'all' yoki building_id.
  const [blockFilter, setBlockFilter] = useState('all');

  const dayWidth = ZOOMS[zoom] || ZOOMS.day;

  // ─── Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return undefined;
    let alive = true;
    setError(null);
    constructionService
      .getWorkSchedule(project.id)
      .then((data) => {
        if (!alive) return;
        setWorks(Array.isArray(data?.works) ? data.works : []);
        setDeps(Array.isArray(data?.dependencies) ? data.dependencies : []);
        setProjInfo(data?.project || null);
      })
      .catch((e) => {
        console.error('Failed to load work schedule:', e);
        if (alive) setError(getApiErrorMessage(e, t('mfg_gantt_error') || "Jadvalni yuklab bo'lmadi"));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, reloadKey]);

  const retry = useCallback(() => { setLoading(true); setReloadKey((k) => k + 1); }, []);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // ─── Derived model ───────────────────────────────────────────────────
  const workById = useMemo(() => {
    const m = new Map();
    (works || []).forEach((w) => m.set(w.id, w));
    return m;
  }, [works]);

  // Bloklar. Har bir blok odatda birinchisidan nusxa olinadi, shuning uchun
  // bitta ish nomi blok soniga teng marta takrorlanadi va grafikda bir xil
  // qatorlar ketma-ket chiqadi. Blok bo'yicha filtr + qatordagi blok yorlig'i
  // shu chalkashlikni yo'qotadi. Faqat bittadan ortiq blok bo'lsa ko'rsatiladi.
  const blockOptions = useMemo(() => {
    const m = new Map();
    (works || []).forEach((w) => {
      const id = Number(w.building_id) || 0;
      if (!id) return;
      if (!m.has(id)) m.set(id, w.building_name || `#${id}`);
    });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [works]);

  const visibleWorks = useMemo(() => {
    if (blockFilter === 'all') return works || [];
    const id = Number(blockFilter);
    return (works || []).filter((w) => Number(w.building_id) === id);
  }, [works, blockFilter]);

  // Contiguous section groups (works arrive ordered by sort_order).
  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    for (const w of visibleWorks) {
      const name = w.section || 'Boshqalar';
      if (!cur || cur.name !== name) { cur = { name, works: [] }; out.push(cur); }
      cur.works.push(w);
    }
    return out;
  }, [visibleWorks]);

  // Cost-weighted progress + span per group (weight = total_amount,
  // fallback quantity).
  const groupStats = useMemo(() => groups.map((g) => {
    let wsum = 0;
    let psum = 0;
    let minS = null;
    let maxE = null;
    for (const w of g.works) {
      const weight = Number(w.total_amount) || Number(w.quantity) || 0;
      wsum += weight;
      psum += weight * (Number(w.progress_pct) || 0);
      if (w.sched_start && (!minS || dayDiff(w.sched_start, minS) < 0)) minS = w.sched_start;
      if (w.sched_end && (!maxE || dayDiff(w.sched_end, maxE) > 0)) maxE = w.sched_end;
    }
    return { pct: wsum > 0 ? psum / wsum : 0, minS, maxE };
  }), [groups]);

  // Flat row list: section header rows + (non-collapsed) work rows.
  const rows = useMemo(() => {
    const out = [];
    groups.forEach((g, gi) => {
      out.push({ type: 'section', key: `s${gi}`, gi });
      if (!collapsed.has(g.name)) {
        for (const w of g.works) out.push({ type: 'work', key: `w${w.id}`, work: w });
      }
    });
    return out;
  }, [groups, collapsed]);

  const rowIndexById = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => { if (r.type === 'work') m.set(r.work.id, i); });
    return m;
  }, [rows]);

  // Timeline range: min(all dates, planned_start, today) − 7 →
  // max(all dates, today) + 14, capped at MAX_RANGE_DAYS.
  const range = useMemo(() => {
    const today = todayISO();
    let min = today;
    let max = today;
    const push = (d) => {
      if (!d) return;
      if (dayDiff(d, min) < 0) min = d;
      if (dayDiff(d, max) > 0) max = d;
    };
    visibleWorks.forEach((w) => {
      push(w.sched_start); push(w.sched_end);
      push(w.baseline_start); push(w.baseline_end);
    });
    if (projInfo?.planned_start_date && dayDiff(projInfo.planned_start_date, min) < 0) {
      min = projInfo.planned_start_date;
    }
    const start = addDays(min, -7);
    let end = addDays(max, 14);
    if (dayDiff(end, start) + 1 > MAX_RANGE_DAYS) end = addDays(start, MAX_RANGE_DAYS - 1);
    return { start, end, dayCount: dayDiff(end, start) + 1 };
  }, [works, projInfo]);

  const gridWidth = range.dayCount * dayWidth;
  const todayIdx = dayDiff(todayISO(), range.start);

  const days = useMemo(
    () => Array.from({ length: range.dayCount }, (_, i) => addDays(range.start, i)),
    [range.start, range.dayCount]
  );

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

  const sundayIdxs = useMemo(
    () => days.reduce((acc, d, i) => { if (parseDay(d).getDay() === 0) acc.push(i); return acc; }, []),
    [days]
  );

  const mondayTicks = useMemo(
    () => days.reduce((acc, d, i) => { if (parseDay(d).getDay() === 1) acc.push({ idx: i, label: ddmm(d) }); return acc; }, []),
    [days]
  );

  const selected = selectedId != null ? (workById.get(selectedId) || null) : null;
  const unscheduledCount = visibleWorks.filter((w) => !isScheduled(w)).length;
  const scheduledCount = visibleWorks.length - unscheduledCount;
  const today = todayISO();

  // ─── Selection side effects ──────────────────────────────────────────
  useEffect(() => {
    const w = selectedId != null ? workById.get(selectedId) : null;
    setProgressInput(w ? String(Math.round(Number(w.progress_pct) || 0)) : '');
    setDepPredId('');
    setDepLag('0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ─── Fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.();
  };

  // ─── Viewport / scroll ───────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      const el = scrollerRef.current;
      if (el) setViewportH(el.clientHeight || 560);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, isFullscreen]);

  // Bring today into view on first load and when the zoom changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || loading) return;
    if (todayIdx >= 0 && todayIdx < range.dayCount) {
      el.scrollLeft = Math.max(0, todayIdx * dayWidth - Math.max(0, el.clientWidth - RAIL_W) / 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWidth, loading]);

  const goToday = () => {
    const el = scrollerRef.current;
    if (!el || todayIdx < 0 || todayIdx >= range.dayCount) return;
    el.scrollTo({
      left: Math.max(0, todayIdx * dayWidth - Math.max(0, el.clientWidth - RAIL_W) / 3),
      behavior: 'smooth',
    });
  };

  const onScroll = (e) => setScrollTop(e.currentTarget.scrollTop);

  // ─── Undo / commit ───────────────────────────────────────────────────
  const undoRestore = useCallback(async (items) => {
    // Null-null pair = unschedule (the bulk endpoint clears dates), so a
    // freshly-scheduled work can be undone back to "rejalashtirilmagan".
    const valid = (items || []).filter((i) =>
      (i.sched_start && i.sched_end) || (!i.sched_start && !i.sched_end));
    if (valid.length === 0) return;
    try {
      await constructionService.bulkUpdateWorkSchedule(project.id, valid);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    } finally {
      // Re-fetch after undo so propagated rows stay consistent with the server.
      setReloadKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const commitSchedule = useCallback(async (work, newStart, newEnd) => {
    const oldStart = work.sched_start || null;
    const oldEnd = work.sched_end || null;
    if (newStart === oldStart && newEnd === oldEnd) return;
    setPendingIds((prev) => new Set(prev).add(work.id));
    setWorks((prev) => (prev || []).map((w) => (
      w.id === work.id ? { ...w, sched_start: newStart, sched_end: newEnd } : w
    )));
    try {
      const res = await constructionService.updateWorkSchedule(work.id, {
        sched_start: newStart, sched_end: newEnd,
      });
      const updated = Array.isArray(res?.updated) ? res.updated : [];
      if (updated.length > 0) {
        const byId = new Map(updated.map((u) => [u.id, u]));
        setWorks((prev) => (prev || []).map((w) => {
          const u = byId.get(w.id);
          return u ? { ...w, sched_start: u.sched_start, sched_end: u.sched_end } : w;
        }));
      }
      const prevItems = updated
        .filter((u) => (u.prev_start && u.prev_end) || (!u.prev_start && !u.prev_end))
        .map((u) => ({ line_id: u.id, sched_start: u.prev_start || null, sched_end: u.prev_end || null }));
      const n = updated.length || 1;
      toast.success((t('gpr_updated_n') || '{n} ta ish yangilandi').replace('{n}', String(n)), {
        action: prevItems.length > 0 ? {
          label: t('gpr_undo') || 'Bekor qilish',
          onClick: () => undoRestore(prevItems),
        } : undefined,
      });
    } catch (e) {
      // Revert the optimistic move.
      setWorks((prev) => (prev || []).map((w) => (
        w.id === work.id ? { ...w, sched_start: oldStart, sched_end: oldEnd } : w
      )));
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(work.id);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoRestore]);

  const shiftWork = useCallback((work, delta) => {
    if (!canEdit || !isScheduled(work) || pendingIds.has(work.id)) return;
    commitSchedule(work, addDays(work.sched_start, delta), addDays(work.sched_end, delta));
  }, [canEdit, pendingIds, commitSchedule]);

  // ─── Bar drag / resize (pointer events) ──────────────────────────────
  const onBarPointerDown = (e, w) => {
    if (e.button !== 0) return;
    movedRef.current = false;
    if (!canEdit || pendingIds.has(w.id)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mode = rect.right - e.clientX <= RESIZE_ZONE ? 'resize' : 'move';
    const st = { id: w.id, mode, startClientX: e.clientX, deltaDays: 0 };
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

  const onBarPointerUp = (e, w) => {
    const st = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (!st || st.id !== w.id || st.deltaDays === 0) return;
    if (st.mode === 'move') {
      commitSchedule(w, addDays(w.sched_start, st.deltaDays), addDays(w.sched_end, st.deltaDays));
    } else {
      let newEnd = addDays(w.sched_end, st.deltaDays);
      if (dayDiff(newEnd, w.sched_start) < 0) newEnd = w.sched_start;
      commitSchedule(w, w.sched_start, newEnd);
    }
  };

  const onBarKeyDown = (e, w) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(w.id);
      setSelectedDepId(null);
      return;
    }
    if (e.key === 'Escape') { setSelectedId(null); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!canEdit || !isScheduled(w) || pendingIds.has(w.id)) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    if (e.shiftKey) {
      let newEnd = addDays(w.sched_end, delta);
      if (dayDiff(newEnd, w.sched_start) < 0) newEnd = w.sched_start;
      commitSchedule(w, w.sched_start, newEnd);
    } else {
      commitSchedule(w, addDays(w.sched_start, delta), addDays(w.sched_end, delta));
    }
  };

  // ─── Dependencies ────────────────────────────────────────────────────
  const createDependency = useCallback(async (predId, succId, lag) => {
    try {
      const dep = await constructionService.createWorkDependency(project.id, {
        predecessor_line_id: predId,
        successor_line_id: succId,
        lag_days: Number(lag) || 0,
      });
      if (dep && dep.id != null) setDeps((prev) => [...prev, dep]);
      else setReloadKey((k) => k + 1);
      toast.success(t('gpr_dep_created') || "Bog'liqlik qo'shildi");
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const removeDependency = useCallback(async (dep) => {
    try {
      await constructionService.deleteWorkDependency(dep.id);
      setDeps((prev) => prev.filter((d) => d.id !== dep.id));
      setSelectedDepId(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag-connect from the small circle handle at the right end of a bar.
  const onDepHandleDown = (e, w, x1, y1) => {
    if (!canEdit || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const st = { fromId: w.id, x1, y1, x: x1, y: y1 };
    depDragRef.current = st;
    setDepDrag(st);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onDepHandleMove = (e) => {
    const st = depDragRef.current;
    if (!st) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = { ...st, x: e.clientX - rect.left, y: e.clientY - rect.top };
    depDragRef.current = next;
    setDepDrag(next);
  };

  const onDepHandleUp = (e) => {
    const st = depDragRef.current;
    depDragRef.current = null;
    setDepDrag(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!st) return;
    const idx = Math.floor(st.y / ROW_H);
    const r = rows[idx];
    if (!r || r.type !== 'work') return; // released elsewhere → cancel silently
    const target = r.work;
    if (!target || target.id === st.fromId || !isScheduled(target)) return;
    createDependency(st.fromId, target.id, 0);
  };

  // Arrow geometry — index-derived, skips hidden/unscheduled endpoints.
  const arrows = useMemo(() => {
    const out = [];
    for (const d of deps) {
      const pi = rowIndexById.get(d.predecessor_line_id);
      const si = rowIndexById.get(d.successor_line_id);
      if (pi == null || si == null) continue;
      const pw = workById.get(d.predecessor_line_id);
      const sw = workById.get(d.successor_line_id);
      if (!isScheduled(pw) || !isScheduled(sw)) continue;
      out.push({
        dep: d,
        x1: (dayDiff(pw.sched_end, range.start) + 1) * dayWidth,
        y1: pi * ROW_H + ROW_H / 2,
        x2: dayDiff(sw.sched_start, range.start) * dayWidth,
        y2: si * ROW_H + ROW_H / 2,
      });
    }
    return out;
  }, [deps, rowIndexById, workById, range.start, dayWidth]);

  const elbowPath = (a) => {
    const { x1, y1, x2, y2 } = a;
    if (x2 >= x1 + 14) {
      const mx = x1 + 7;
      return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2 - 2} ${y2}`;
    }
    const dir = y2 >= y1 ? 1 : -1;
    const midY = y1 + dir * (ROW_H / 2);
    return `M ${x1} ${y1} L ${x1 + 7} ${y1} L ${x1 + 7} ${midY} L ${x2 - 10} ${midY} L ${x2 - 10} ${y2} L ${x2 - 2} ${y2}`;
  };

  const selectedArrow = arrows.find((a) => a.dep.id === selectedDepId) || null;

  // ─── Scheduling actions ──────────────────────────────────────────────
  const defaultStart = () => {
    const projStart = projInfo?.planned_start_date;
    if (projStart && dayDiff(projStart, today) > 0) return projStart;
    return today;
  };

  const addToSchedule = useCallback(async (w) => {
    const start = defaultStart();
    try {
      await constructionService.bulkUpdateWorkSchedule(project.id, [
        { line_id: w.id, sched_start: start, sched_end: start },
      ]);
      setWorks((prev) => (prev || []).map((x) => (
        x.id === w.id ? { ...x, sched_start: start, sched_end: start } : x
      )));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, projInfo]);

  // "Hammasini grafikka qo'shish" — sequential 1-day slots from the
  // project start, one bulk call.
  const scheduleAll = useCallback(async () => {
    const start = defaultStart();
    // Filtrlangan ko'rinishda faqat ko'rinib turgan bloklar rejalashtiriladi —
    // tugma ekranda turgan ro'yxatga tegishli.
    const unsched = visibleWorks.filter((w) => !isScheduled(w));
    if (unsched.length === 0) return;
    const items = unsched.map((w, i) => ({
      line_id: w.id,
      sched_start: addDays(start, i),
      sched_end: addDays(start, i),
    }));
    try {
      await constructionService.bulkUpdateWorkSchedule(project.id, items);
      const byId = new Map(items.map((it) => [it.line_id, it]));
      setWorks((prev) => (prev || []).map((w) => {
        const it = byId.get(w.id);
        return it ? { ...w, sched_start: it.sched_start, sched_end: it.sched_end } : w;
      }));
      toast.success((t('gpr_updated_n') || '{n} ta ish yangilandi').replace('{n}', String(items.length)));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, visibleWorks, projInfo]);

  const freezeBaseline = async () => {
    if (!window.confirm(t('gpr_freeze_confirm') || 'Joriy sanalar tayanch reja sifatida saqlanadi. Davom etasizmi?')) return;
    setFreezing(true);
    try {
      await constructionService.freezeScheduleBaseline(project.id);
      toast.success(t('gpr_frozen_ok') || 'Tayanch reja saqlandi');
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    } finally {
      setFreezing(false);
    }
  };

  // ─── Footer panel actions ────────────────────────────────────────────
  const onStartInput = (val) => {
    if (!val || !selected) return;
    let ns = val;
    let ne = selected.sched_end || val;
    if (dayDiff(ne, ns) < 0) ne = ns;
    commitSchedule(selected, ns, ne);
  };

  const onEndInput = (val) => {
    if (!val || !selected) return;
    const ns = selected.sched_start || val;
    let ne = val;
    if (dayDiff(ne, ns) < 0) ne = ns;
    commitSchedule(selected, ns, ne);
  };

  const saveProgress = async () => {
    if (!selected) return;
    const qty = Number(selected.quantity) || 0;
    if (qty <= 0) return;
    const pct = Math.min(100, Math.max(0, Number(progressInput) || 0));
    const done = Math.round(qty * pct / 100 * 10000) / 10000;
    setSavingProgress(true);
    try {
      await constructionService.updateWorkDoneQuantity(selected.id, done);
      setWorks((prev) => (prev || []).map((w) => (
        w.id === selected.id ? { ...w, done_quantity: done, progress_pct: pct } : w
      )));
      toast.success(t('gpr_progress_saved') || 'Bajarilish saqlandi');
    } catch (e) {
      if (e?.response?.status === 403) {
        toast.error(t('gpr_progress_denied') || 'Bajarilishni faqat biriktirilgan prorab kirita oladi');
      } else {
        toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
      }
    } finally {
      setSavingProgress(false);
    }
  };

  // ─── Exports ─────────────────────────────────────────────────────────
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'GenixERP';
      wb.created = new Date();
      const ws = wb.addWorksheet(t('nav_work_schedule') || 'Ish grafigi');
      ws.columns = [
        { width: 9 },   // №
        { width: 28 },  // Bo'lim
        { width: 48 },  // Ish
        { width: 10 },  // O'lchov
        { width: 12 },  // Miqdor
        { width: 9 },   // Kunlar
        { width: 13 },  // Boshlanish
        { width: 13 },  // Tugash
        { width: 13 },  // Bajarilgan %
      ];
      const header = ws.addRow([
        '№', "Bo'lim", t('gpr_col_work') || 'Ish', "O'lchov", 'Miqdor',
        t('gpr_col_days') || 'Kunlar', t('gpr_col_start') || 'Boshlanish',
        t('gpr_col_end') || 'Tugash', `${t('gpr_progress') || 'Bajarilgan'} %`,
      ]);
      header.font = { bold: true };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
      groups.forEach((g, gi) => {
        const secRow = ws.addRow(['', g.name, '', '', '', '', '', '', Math.round(groupStats[gi]?.pct || 0)]);
        secRow.font = { bold: true };
        for (const w of g.works) {
          ws.addRow([
            w.item_number || '',
            '',
            w.name || '',
            w.uom || '',
            Number(w.quantity) || 0,
            isScheduled(w) ? dayDiff(w.sched_end, w.sched_start) + 1 : '',
            w.sched_start || '',
            w.sched_end || '',
            Math.round(Number(w.progress_pct) || 0),
          ]);
        }
      });
      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `ish-grafigi-${project?.id || 'export'}.xlsx`,
      );
    } catch (e) {
      console.error('XLSX export failed:', e);
      toast.error(getApiErrorMessage(e, t('gpr_update_failed') || 'Yangilash amalga oshmadi'));
    } finally {
      setExporting(false);
    }
  };

  // Simple offscreen-canvas PNG: names column + date scale + bars.
  const exportPNG = () => {
    try {
      const leftW = 280;
      const pxDay = Math.max(2, Math.min(14, Math.floor(3400 / Math.max(1, range.dayCount))));
      const headerH = 44;
      const rH = 22;
      const width = leftW + range.dayCount * pxDay + 20;
      const height = headerH + rows.length * rH + 16;
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Date scale: month boundaries + labels.
      ctx.strokeStyle = '#E2E8F0';
      ctx.fillStyle = '#64748B';
      ctx.font = '11px sans-serif';
      let dayAcc = 0;
      for (const seg of monthSegments) {
        const x = leftW + dayAcc * pxDay;
        ctx.beginPath();
        ctx.moveTo(x, headerH - 16);
        ctx.lineTo(x, height - 8);
        ctx.stroke();
        if (seg.span * pxDay > 34) ctx.fillText(seg.label, x + 3, headerH - 22);
        dayAcc += seg.span;
      }
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(0, headerH - 4);
      ctx.lineTo(width, headerH - 4);
      ctx.stroke();

      const maxChars = Math.floor((leftW - 20) / 6.6);
      const clip = (s) => {
        const str = String(s || '');
        return str.length > maxChars ? `${str.slice(0, maxChars - 1)}…` : str;
      };

      rows.forEach((r, i) => {
        const y = headerH + i * rH;
        if (r.type === 'section') {
          ctx.fillStyle = '#F1F5F9';
          ctx.fillRect(0, y, width, rH);
          ctx.fillStyle = '#334155';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(clip(groups[r.gi]?.name), 8, y + 15);
          return;
        }
        const w = r.work;
        ctx.fillStyle = isScheduled(w) ? '#334155' : '#94A3B8';
        ctx.font = '13px sans-serif';
        const pngBlock = blockFilter === 'all' && blockOptions.length > 1 && w.building_name
          ? `${w.building_name} · ` : '';
        ctx.fillText(clip(`${pngBlock}${w.item_number ? `${w.item_number} ` : ''}${w.name || ''}`), 14, y + 15);
        // Baseline ghost (gray outline).
        if (w.baseline_start && w.baseline_end) {
          const bs = Math.max(0, dayDiff(w.baseline_start, range.start));
          const be = Math.min(range.dayCount - 1, dayDiff(w.baseline_end, range.start));
          if (be >= bs) {
            ctx.strokeStyle = '#94A3B8';
            ctx.strokeRect(leftW + bs * pxDay, y + rH - 6, (be - bs + 1) * pxDay, 4);
          }
        }
        if (isScheduled(w)) {
          const s = Math.max(0, dayDiff(w.sched_start, range.start));
          const e = Math.min(range.dayCount - 1, dayDiff(w.sched_end, range.start));
          if (e >= s) {
            const bx = leftW + s * pxDay;
            const bw = Math.max(2, (e - s + 1) * pxDay);
            ctx.fillStyle = '#6C5CE7';
            ctx.fillRect(bx, y + 4, bw, 12);
            const pct = Math.min(100, Math.max(0, Number(w.progress_pct) || 0));
            if (pct > 0) {
              ctx.fillStyle = '#4A6CF7';
              ctx.fillRect(bx, y + 4, bw * pct / 100, 12);
            }
          }
        }
      });

      // Today line.
      if (todayIdx >= 0 && todayIdx < range.dayCount) {
        const tx = leftW + todayIdx * pxDay + pxDay / 2;
        ctx.strokeStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(tx, headerH - 10);
        ctx.lineTo(tx, height - 8);
        ctx.stroke();
      }

      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `ish-grafigi-${project?.id || 'export'}.png`);
      });
    } catch (e) {
      console.error('PNG export failed:', e);
      toast.error(t('gpr_update_failed') || 'Yangilash amalga oshmadi');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-8 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-[480px] rounded-2xl" />
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
              {t('retry') || 'Qayta urinish'}
            </Button>
          )}
        />
      </div>
    );
  }

  if (!works || works.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm">
        <EmptyNote
          icon={ClipboardList}
          text={t('gpr_no_works') || "Hozircha ishlar yo'q — avval smeta tuzing"}
          cta={onOpenSmeta ? (
            <Button size="sm" onClick={onOpenSmeta} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {t('gpr_open_smeta') || 'Smetani ochish'}
            </Button>
          ) : null}
        />
      </div>
    );
  }

  const weekdays = WEEKDAYS[language] || WEEKDAYS.uz;
  const totalH = rows.length * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(rows.length - 1, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN);
  const windowRows = [];
  for (let i = startIdx; i <= endIdx; i++) windowRows.push({ row: rows[i], idx: i });

  const selPending = selected ? pendingIds.has(selected.id) : false;
  const selQty = Number(selected?.quantity) || 0;
  const selPreds = selected ? deps.filter((d) => d.successor_line_id === selected.id) : [];

  return (
    <div ref={rootRef} className={cn('space-y-4', isFullscreen && 'bg-white p-4 overflow-auto')}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 tabular-nums">
            {visibleWorks.length} {t('gpr_works') || 'ta ish'}
          </span>
          {blockOptions.length > 1 && (
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="all">
                {t('gpr_all_blocks') || 'Barcha bloklar'} ({blockOptions.length})
              </option>
              {blockOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          )}
          {unscheduledCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 tabular-nums">
              {unscheduledCount} · {t('gpr_unscheduled') || 'Rejalashtirilmagan'}
            </span>
          )}
          {canEdit && scheduledCount === 0 && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={scheduleAll}>
              <Plus className="w-3.5 h-3.5" />
              {t('gpr_add_all_to_schedule') || "Hammasini grafikka qo'shish"}
            </Button>
          )}
          {/* Avtomatik rejalashtirish — minglab pozitsiyaga sanani qo'lda
              qo'yish o'rniga bitta tugma (TZ §6.1). */}
          {canEdit && (
            <Button
              size="sm"
              variant={unscheduledCount > 0 ? 'default' : 'outline'}
              className="h-7 gap-1.5 text-xs"
              onClick={() => setAutoOpen(true)}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {t('gpr_auto_schedule') || 'Avtomatik rejalashtirish'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            options={[
              { id: 'day', label: t('gpr_zoom_day') || 'Kun' },
              { id: 'week', label: t('gpr_zoom_week') || 'Hafta' },
              { id: 'month', label: t('gpr_zoom_month') || 'Oy' },
            ]}
            value={zoom}
            onChange={setZoom}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={goToday}>
            <CalendarDays className="w-3.5 h-3.5" />
            {t('gpr_today') || 'Bugun'}
          </Button>
          {canEdit && (
            <Button
              size="sm" variant="outline" className="h-8 gap-1.5"
              disabled={freezing || scheduledCount === 0}
              onClick={freezeBaseline}
              title={t('gpr_freeze_confirm') || ''}
            >
              <Lock className="w-3.5 h-3.5" />
              {t('gpr_freeze_baseline') || 'Grafikni muzlatish'}
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={exporting} onClick={exportXLSX} title={t('gpr_export_xlsx') || 'Excel'}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            XLSX
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportPNG} title={t('gpr_export_png') || 'PNG'}>
            <ImageIcon className="w-3.5 h-3.5" />
            PNG
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={toggleFullscreen}
            aria-label={t('gpr_fullscreen') || "To'liq ekran"}
            title={t('gpr_fullscreen') || "To'liq ekran"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Gantt */}
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm overflow-hidden">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="overflow-auto overscroll-x-contain"
          style={{ maxHeight: isFullscreen ? 'calc(100vh - 130px)' : '64vh', minHeight: 320 }}
        >
          <div style={{ width: RAIL_W + gridWidth, minWidth: '100%' }}>
            {/* Sticky header: month band + tick row */}
            <div className="sticky top-0 z-30">
              <div className="flex bg-slate-50 border-b border-slate-100" style={{ height: MONTH_H }}>
                <div className="sticky left-0 z-40 shrink-0 bg-slate-50 border-r border-slate-200" style={{ width: RAIL_W }} />
                <div className="flex">
                  {monthSegments.map((seg, i) => (
                    <div
                      key={`${seg.label}-${i}`}
                      className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 border-r border-slate-100 truncate leading-5"
                      style={{ width: seg.span * dayWidth }}
                    >
                      {seg.span * dayWidth >= 40 ? seg.label : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex bg-slate-50 border-b border-slate-200" style={{ height: TICK_H }}>
                <div
                  className="sticky left-0 z-40 shrink-0 flex items-center bg-slate-50 border-r border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                  style={{ width: RAIL_W }}
                >
                  {/* Short labels + truncate: the columns are narrow (42/56px)
                      and sum exactly to RAIL_W, so full words ("BOSHLANISH")
                      overflowed and ran into the next header. title= keeps the
                      full name on hover. */}
                  <span className="px-2 truncate" style={{ width: NAME_W }}>{t('gpr_col_work') || 'Ish'}</span>
                  <span className="text-center truncate px-0.5" style={{ width: DAYS_W }} title={t('gpr_col_days') || 'Kunlar'}>
                    {t('gpr_col_days_short') || 'Kun'}
                  </span>
                  <span className="text-center truncate px-0.5" style={{ width: DATE_W }} title={t('gpr_col_start') || 'Boshlanish'}>
                    {t('gpr_col_start_short') || 'Boshl.'}
                  </span>
                  <span className="text-center truncate px-0.5" style={{ width: DATE_W }} title={t('gpr_col_end') || 'Tugash'}>
                    {t('gpr_col_end_short') || 'Tugash'}
                  </span>
                </div>
                <div className="relative" style={{ width: gridWidth }}>
                  {zoom === 'day' && days.map((d, i) => {
                    const wd = parseDay(d).getDay();
                    const isToday = i === todayIdx;
                    return (
                      <div
                        key={d}
                        className={cn(
                          'absolute inset-y-0 flex items-center justify-center gap-1 border-r border-slate-100',
                          wd === 0 && 'bg-slate-100/60',
                          isToday && 'bg-orange-50',
                        )}
                        style={{ left: i * dayWidth, width: dayWidth }}
                      >
                        <span className="text-[8px] text-slate-400">{weekdays[wd]}</span>
                        <span className={cn('text-[10px] font-semibold tabular-nums', isToday ? 'text-orange-600' : 'text-slate-600')}>
                          {d.slice(8, 10)}
                        </span>
                      </div>
                    );
                  })}
                  {zoom === 'week' && mondayTicks.map((m) => (
                    <div
                      key={m.idx}
                      className="absolute inset-y-0 flex items-center border-l border-slate-200 pl-1"
                      style={{ left: m.idx * dayWidth, width: 7 * dayWidth }}
                    >
                      <span className="text-[9px] font-medium text-slate-500 tabular-nums truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative" style={{ height: totalH }}>
              {/* Weekend shading + today line behind all rows */}
              <div className="absolute inset-y-0 pointer-events-none" style={{ left: RAIL_W, width: gridWidth }}>
                {sundayIdxs.map((i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 bg-slate-100/60"
                    style={{ left: i * dayWidth, width: dayWidth }}
                  />
                ))}
                {todayIdx >= 0 && todayIdx < range.dayCount && (
                  <>
                    <div
                      className="absolute inset-y-0 w-px z-10"
                      style={{ left: todayIdx * dayWidth + Math.floor(dayWidth / 2), background: 'var(--genix-coral)' }}
                    />
                    <div
                      className="absolute w-2 h-2 rounded-full -translate-x-1/2 z-10"
                      style={{ left: todayIdx * dayWidth + Math.floor(dayWidth / 2), top: 0, background: 'var(--genix-coral)' }}
                    />
                  </>
                )}
              </div>

              {/* Windowed rows */}
              {windowRows.map(({ row, idx }) => {
                if (!row) return null;
                if (row.type === 'section') {
                  const g = groups[row.gi];
                  const st = groupStats[row.gi] || {};
                  const isCollapsed = collapsed.has(g.name);
                  const spanVisible = st.minS && st.maxE;
                  const sIdx = spanVisible ? Math.max(0, dayDiff(st.minS, range.start)) : 0;
                  const eIdx = spanVisible ? Math.min(range.dayCount - 1, dayDiff(st.maxE, range.start)) : 0;
                  return (
                    <div
                      key={row.key}
                      className="absolute left-0 flex border-b border-slate-200 bg-slate-50"
                      style={{ top: idx * ROW_H, height: ROW_H, width: RAIL_W + gridWidth }}
                    >
                      <button
                        type="button"
                        onClick={() => setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.name)) next.delete(g.name);
                          else next.add(g.name);
                          return next;
                        })}
                        className="sticky left-0 z-20 shrink-0 flex items-center gap-1.5 px-2 text-left bg-slate-100 border-r border-slate-200"
                        style={{ width: RAIL_W }}
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 truncate" title={g.name}>
                          {g.name}
                        </span>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap tabular-nums">
                          {g.works.length} {t('gpr_works') || 'ta ish'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                          {Math.round(st.pct || 0)}%
                        </span>
                      </button>
                      <div className="relative" style={{ width: gridWidth }}>
                        {spanVisible && eIdx >= sIdx && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full border border-slate-400/60 bg-slate-300/25 pointer-events-none"
                            style={{ left: sIdx * dayWidth + 1, width: Math.max(4, (eIdx - sIdx + 1) * dayWidth - 2) }}
                          />
                        )}
                      </div>
                    </div>
                  );
                }

                const w = row.work;
                const scheduled = isScheduled(w);
                const isSelected = selectedId === w.id;
                const pending = pendingIds.has(w.id);
                const overdue = scheduled && dayDiff(w.sched_end, today) < 0 && (Number(w.progress_pct) || 0) < 100;
                const confirmed = w.approval_status === 'confirmed_engineer';
                const pct = Math.min(100, Math.max(0, Number(w.progress_pct) || 0));

                let bar = null;
                let barRight = 0;
                if (scheduled) {
                  const rawS = dayDiff(w.sched_start, range.start);
                  const rawE = dayDiff(w.sched_end, range.start);
                  const isDragging = drag?.id === w.id;
                  const dMove = isDragging && drag.mode === 'move' ? drag.deltaDays : 0;
                  const dResize = isDragging && drag.mode === 'resize' ? drag.deltaDays : 0;
                  const effS = rawS + dMove;
                  const effE = Math.max(effS, rawE + dMove + dResize);
                  const cs = Math.max(0, effS);
                  const ce = Math.min(range.dayCount - 1, effE);
                  const visible = ce >= 0 && cs <= range.dayCount - 1 && ce >= cs;
                  barRight = (ce + 1) * dayWidth;
                  if (visible) {
                    const left = cs * dayWidth + 1;
                    const widthPx = Math.max(dayWidth - 2, (ce - cs + 1) * dayWidth - 2);
                    const interactive = canEdit && !pending;
                    bar = (
                      <>
                        {/* Baseline ghost behind/below the live bar */}
                        {w.baseline_start && w.baseline_end && (() => {
                          const bs = Math.max(0, dayDiff(w.baseline_start, range.start));
                          const be = Math.min(range.dayCount - 1, dayDiff(w.baseline_end, range.start));
                          if (be < bs) return null;
                          return (
                            <div
                              className="absolute h-5 rounded-lg bg-slate-400/30 pointer-events-none"
                              style={{
                                left: bs * dayWidth + 1,
                                width: Math.max(4, (be - bs + 1) * dayWidth - 2),
                                top: '50%',
                                transform: 'translateY(calc(-50% + 3px))',
                              }}
                            />
                          );
                        })()}
                        {/* Dashed outline at the original slot while dragging */}
                        {drag?.id === w.id && drag.deltaDays !== 0 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border border-dashed border-slate-300 pointer-events-none"
                            style={{
                              left: Math.max(0, rawS) * dayWidth + 1,
                              width: Math.max(4, (Math.min(range.dayCount - 1, rawE) - Math.max(0, rawS) + 1) * dayWidth - 2),
                            }}
                          />
                        )}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${w.item_number || ''} ${w.name || ''} ${ddmm(w.sched_start)} — ${ddmm(w.sched_end)}`}
                          onPointerDown={(e) => onBarPointerDown(e, w)}
                          onPointerMove={onBarPointerMove}
                          onPointerUp={(e) => onBarPointerUp(e, w)}
                          onClick={() => { if (!movedRef.current) { setSelectedId(w.id); setSelectedDepId(null); } }}
                          onKeyDown={(e) => onBarKeyDown(e, w)}
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 h-5 flex items-center rounded-lg select-none touch-none bg-gradient-to-r',
                            confirmed
                              ? 'from-emerald-400 to-emerald-600'
                              : 'from-[var(--genix-blue)] to-[var(--genix-purple)]',
                            pending ? 'opacity-60 pointer-events-none' : '',
                            interactive ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            drag?.id === w.id ? 'shadow-lg z-30 opacity-90' : 'shadow-sm',
                            isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                            overdue ? 'ring-1 ring-red-500' : '',
                          )}
                          style={{ left, width: widthPx }}
                        >
                          {pct > 0 && (
                            <span
                              className="absolute inset-y-0 left-0 bg-white/30 rounded-l-lg pointer-events-none"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          {widthPx >= 46 && (
                            <span className="relative text-[10px] text-white font-semibold px-1.5 truncate pointer-events-none tabular-nums">
                              {drag?.id === w.id && drag.deltaDays !== 0
                                ? `${ddmm(addDays(w.sched_start, dMove))} — ${ddmm(addDays(w.sched_end, dMove + dResize))}`
                                : `${Math.round(pct)}%`}
                            </span>
                          )}
                          {interactive && (
                            <span className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize rounded-r-lg bg-black/10 pointer-events-none" />
                          )}
                        </div>
                        {/* Dependency drag-connect handle */}
                        {canEdit && (
                          <span
                            role="presentation"
                            onPointerDown={(e) => onDepHandleDown(e, w, barRight, idx * ROW_H + ROW_H / 2)}
                            onPointerMove={onDepHandleMove}
                            onPointerUp={onDepHandleUp}
                            className={cn(
                              'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 cursor-crosshair touch-none z-20 transition-opacity',
                              (isSelected || depDrag?.fromId === w.id) ? 'opacity-100' : 'opacity-0 group-hover/gpr-row:opacity-100',
                            )}
                            style={{ left: barRight + 2, borderColor: 'var(--genix-purple)' }}
                            title={t('gpr_add_dependency') || "Bog'liqlik qo'shish"}
                          />
                        )}
                      </>
                    );
                  }
                }

                return (
                  <div
                    key={row.key}
                    className={cn('absolute left-0 flex border-b border-slate-100 group/gpr-row', isSelected && 'bg-blue-50/40')}
                    style={{ top: idx * ROW_H, height: ROW_H, width: RAIL_W + gridWidth }}
                  >
                    {/* Rail */}
                    <div
                      className={cn(
                        'sticky left-0 z-20 shrink-0 flex items-center border-r border-slate-200',
                        isSelected ? 'bg-blue-50' : 'bg-white',
                      )}
                      style={{ width: RAIL_W }}
                    >
                      <button
                        type="button"
                        onClick={() => { setSelectedId(isSelected ? null : w.id); setSelectedDepId(null); }}
                        className="flex items-center gap-1 min-w-0 h-full px-2 text-left"
                        style={{ width: NAME_W }}
                      >
                        <span
                          className={cn('text-xs truncate', scheduled ? 'text-slate-700' : 'text-slate-400')}
                          title={`${w.building_name ? `${w.building_name} · ` : ''}${w.item_number ? `${w.item_number} ` : ''}${w.name || ''}`}
                        >
                          {w.item_number && (
                            <span className="font-mono text-[10px] text-slate-400 mr-1">{w.item_number}</span>
                          )}
                          {/* Bloklar nusxa bo'lgani uchun nom takrorlanadi —
                              "Barcha bloklar" ko'rinishida blokni ko'rsatamiz. */}
                          {blockFilter === 'all' && blockOptions.length > 1 && w.building_name && (
                            <span className="rounded bg-slate-100 px-1 py-px text-[10px] text-slate-500 mr-1">
                              {w.building_name}
                            </span>
                          )}
                          {w.name}
                        </span>
                        {!scheduled && canEdit && (
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => { e.stopPropagation(); addToSchedule(w); }}
                            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500"
                            title={t('gpr_add_to_schedule') || "Grafikka qo'shish"}
                          >
                            <Plus className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                      <span className="text-center text-[11px] tabular-nums text-slate-500" style={{ width: DAYS_W }}>
                        {scheduled ? dayDiff(w.sched_end, w.sched_start) + 1 : '—'}
                      </span>
                      <span className="text-center text-[11px] tabular-nums text-slate-500" style={{ width: DATE_W }}>
                        {scheduled ? ddmm(w.sched_start) : '—'}
                      </span>
                      <span
                        className={cn(
                          'text-center text-[11px] tabular-nums',
                          overdue ? 'text-red-600 font-semibold' : 'text-slate-500',
                        )}
                        style={{ width: DATE_W }}
                        title={overdue ? (t('gpr_overdue') || "Muddati o'tgan") : undefined}
                      >
                        {scheduled ? ddmm(w.sched_end) : '—'}
                      </span>
                    </div>
                    {/* Timeline cell */}
                    <div className="relative" style={{ width: gridWidth }}>
                      {bar}
                    </div>
                  </div>
                );
              })}

              {/* Dependency arrows overlay */}
              <div
                ref={overlayRef}
                className="absolute inset-y-0 z-10"
                style={{ left: RAIL_W, width: gridWidth, pointerEvents: 'none' }}
              >
                <svg width={gridWidth} height={totalH} className="absolute inset-0 overflow-visible" style={{ pointerEvents: 'none' }}>
                  {arrows.map((a) => {
                    const isSel = selectedDepId === a.dep.id;
                    const d = elbowPath(a);
                    return (
                      <g key={a.dep.id}>
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={10}
                          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepId(isSel ? null : a.dep.id);
                          }}
                        />
                        <path
                          d={d}
                          fill="none"
                          stroke="var(--genix-purple)"
                          strokeWidth={isSel ? 2.5 : 1.5}
                          opacity={isSel ? 1 : 0.55}
                        />
                        <polygon
                          points={`${a.x2},${a.y2} ${a.x2 - 6},${a.y2 - 3.5} ${a.x2 - 6},${a.y2 + 3.5}`}
                          fill="var(--genix-purple)"
                          opacity={isSel ? 1 : 0.55}
                        />
                      </g>
                    );
                  })}
                  {depDrag && (
                    <line
                      x1={depDrag.x1}
                      y1={depDrag.y1}
                      x2={depDrag.x}
                      y2={depDrag.y}
                      stroke="var(--genix-purple)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      opacity={0.8}
                    />
                  )}
                </svg>
                {selectedArrow && canEdit && (
                  <button
                    type="button"
                    onClick={() => removeDependency(selectedArrow.dep)}
                    className="absolute z-30 flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-red-200 text-red-600 text-[11px] font-medium shadow-sm hover:bg-red-50 -translate-x-1/2"
                    style={{
                      left: (selectedArrow.x1 + selectedArrow.x2) / 2,
                      top: Math.max(0, (selectedArrow.y1 + selectedArrow.y2) / 2 - 26),
                      pointerEvents: 'auto',
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    {t('gpr_delete') || "O'chirish"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected-work footer panel (accessible fallback for drag-drop) */}
      {selected ? (
        <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm px-4 py-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {selected.item_number && (
                  <span className="font-mono text-xs text-slate-400 mr-1.5">{selected.item_number}</span>
                )}
                {selected.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {selected.section || ''}
                {selected.uom ? ` · ${Number(selected.quantity) || 0} ${selected.uom}` : ''}
              </p>
            </div>
            {isScheduled(selected) && dayDiff(selected.sched_end, today) < 0 && (Number(selected.progress_pct) || 0) < 100 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-semibold uppercase">
                {t('gpr_overdue') || "Muddati o'tgan"}
              </span>
            )}
            <Button
              size="sm" variant="ghost" className="h-8 w-8 p-0 ml-auto"
              onClick={() => setSelectedId(null)}
              aria-label={t('cancel') || 'Yopish'}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={selected.sched_start || ''}
              onChange={(e) => onStartInput(e.target.value)}
              disabled={!canEdit || selPending}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label={t('gpr_col_start') || 'Boshlanish'}
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={selected.sched_end || ''}
              onChange={(e) => onEndInput(e.target.value)}
              disabled={!canEdit || selPending}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label={t('gpr_col_end') || 'Tugash'}
            />
            <span className="text-xs text-slate-500 tabular-nums">
              {isScheduled(selected)
                ? `${dayDiff(selected.sched_end, selected.sched_start) + 1} ${t('gpr_col_days') || 'Kunlar'} · ${t('gpr_duration_note') || 'kalendar kunlarda'}`
                : (t('gpr_unscheduled') || 'Rejalashtirilmagan')}
            </span>
            {canEdit && isScheduled(selected) && (
              <span className="inline-flex items-center gap-1.5 ml-auto">
                <Button
                  size="sm" variant="outline" className="gap-1 h-8"
                  disabled={selPending}
                  onClick={() => shiftWork(selected, -1)}
                >
                  <Minus className="w-3.5 h-3.5" />
                  1
                </Button>
                <Button
                  size="sm" variant="outline" className="gap-1 h-8"
                  disabled={selPending}
                  onClick={() => shiftWork(selected, 1)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  1
                </Button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">{t('gpr_progress') || 'Bajarilgan'}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              disabled={selQty <= 0 || savingProgress}
              className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 tabular-nums"
            />
            <span className="text-xs text-slate-500">%</span>
            <Button size="sm" className="h-8" disabled={selQty <= 0 || savingProgress} onClick={saveProgress}>
              {t('save') || 'Saqlash'}
            </Button>
            {selQty <= 0 && (
              <span className="text-[10px] text-amber-600">
                {t('gpr_qty_zero_hint') || "Miqdor 0 — bajarilish kiritib bo'lmaydi"}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t('gpr_predecessors') || 'Oldingi ishlar'}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selPreds.length === 0 && <span className="text-xs text-slate-400">—</span>}
              {selPreds.map((d) => {
                const pw = workById.get(d.predecessor_line_id);
                return (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    <span className="truncate max-w-[200px]" title={pw?.name || ''}>
                      {pw ? `${pw.item_number ? `${pw.item_number} ` : ''}${pw.name}` : `#${d.predecessor_line_id}`}
                    </span>
                    {Number(d.lag_days) !== 0 && (
                      <span className="text-slate-400 tabular-nums">+{Number(d.lag_days)}</span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeDependency(d)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={t('gpr_delete') || "O'chirish"}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <select
                  value={depPredId}
                  onChange={(e) => setDepPredId(e.target.value)}
                  className="h-8 max-w-[280px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  aria-label={t('gpr_predecessors') || 'Oldingi ishlar'}
                >
                  <option value="">—</option>
                  {works
                    .filter((w) => w.id !== selected.id && isScheduled(w))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {`${w.item_number ? `${w.item_number} ` : ''}${w.name}`}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  value={depLag}
                  onChange={(e) => setDepLag(e.target.value)}
                  className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 tabular-nums"
                  title={t('gpr_lag_days') || 'Kechikish (kun)'}
                  aria-label={t('gpr_lag_days') || 'Kechikish (kun)'}
                />
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5"
                  disabled={!depPredId}
                  onClick={() => {
                    if (!depPredId) return;
                    createDependency(Number(depPredId), selected.id, depLag);
                    setDepPredId('');
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {t('gpr_add_dependency') || "Bog'liqlik qo'shish"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 px-1">
          {t('gpr_select_hint') || "Sanalar, bajarilish va bog'liqliklarni tahrirlash uchun ishni tanlang"}
        </p>
      )}

      <AutoScheduleDialog
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        projectId={project?.id}
        t={t}
        onApplied={refetch}
      />
    </div>
  );
}
