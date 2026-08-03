import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cog, LogOut, ScanLine, X, Minus, Plus, Play, Pause, CheckCircle2, Factory,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  workCentersService, workOrdersService,
} from '@/api/services/manufacturing';
import { getApiErrorMessage } from '@/utils/apiError';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import QCReasonPicker, { composeDefectReason } from './QCReasonPicker';

const WC_STORAGE_KEY = 'genix_kiosk_wc';
const KIOSK_STATUSES = new Set(['pending', 'ready', 'in_progress', 'paused']);
const REFRESH_MS = 30_000;

const pad2 = (n) => String(n).padStart(2, '0');

// Elapsed "HH:MM" since an ISO timestamp.
const elapsedLabel = (iso, nowMs) => {
  if (!iso) return '';
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '';
  const mins = Math.max(0, Math.floor((nowMs - start) / 60000));
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
};

const STATUS_ORDER = { in_progress: 0, paused: 1, ready: 2, pending: 3 };

const STATUS_STYLE = {
  in_progress: 'bg-amber-100 text-amber-800',
  paused: 'bg-orange-100 text-orange-800',
  ready: 'bg-blue-100 text-blue-800',
  pending: 'bg-slate-200 text-slate-700',
};

// Big flat action button — factory-worker UX: >=64px tall, text-xl,
// high contrast, no glass.
function BigButton({ onClick, disabled, tone = 'green', children }) {
  const tones = {
    green: 'bg-green-600 hover:bg-green-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    slate: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-h-[64px] rounded-2xl text-xl font-bold tracking-wide flex items-center justify-center gap-3 transition-colors disabled:opacity-40 disabled:pointer-events-none ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Stepper({ label, value, onChange }) {
  const num = parseFloat(value) || 0;
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold text-slate-700">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, num - 1)))}
          className="w-16 h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
        >
          <Minus className="w-7 h-7 text-slate-700" />
        </button>
        <Input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          className="h-16 text-center text-3xl font-bold tabular-nums"
        />
        <button
          type="button"
          onClick={() => onChange(String(num + 1))}
          className="w-16 h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
        >
          <Plus className="w-7 h-7 text-slate-700" />
        </button>
      </div>
    </div>
  );
}

// Ustaxona kiosk — tablet-first shop-floor terminal. Work-center picker →
// big operation cards with giant BOSHLASH / TO'XTATISH / TOPSHIRISH
// buttons, barcode-wedge scanning, 30s visibility-aware auto-refresh.
export default function KioskMode() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();

  const [workCenters, setWorkCenters] = useState([]);
  const [wcId, setWcId] = useState(() => localStorage.getItem(WC_STORAGE_KEY) || '');
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null); // full-width red error banner
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [highlightId, setHighlightId] = useState(null);
  const [scanMiss, setScanMiss] = useState(null);

  // TOPSHIRISH dialog state
  const [completeWO, setCompleteWO] = useState(null);
  const [good, setGood] = useState('0');
  const [scrap, setScrap] = useState('0');
  const [qc, setQc] = useState({ reason: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const scanRef = useRef(null);
  const cardRefs = useRef({});
  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = !!completeWO;

  const wc = workCenters.find((w) => w.id === wcId) || null;

  // ─── Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    workCentersService
      .list(undefined, { limit: 200 })
      .then((data) => { if (alive) setWorkCenters(Array.isArray(data) ? data : []); })
      .catch((e) => {
        console.error('Kiosk: failed to load work centers:', e);
        if (alive) setBanner(getApiErrorMessage(e, t('kiosk_load_failed')));
      })
      .finally(() => { if (alive && !wcId) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBoard = useCallback(async (silent = false) => {
    if (!wcId) return;
    if (!silent) setLoading(true);
    try {
      const data = await workOrdersService.list(undefined, { work_center_id: wcId, limit: 500 });
      setWorkOrders((Array.isArray(data) ? data : []).filter((wo) => KIOSK_STATUSES.has(wo.status)));
      setBanner(null);
    } catch (e) {
      console.error('Kiosk: failed to load work orders:', e);
      setBanner(getApiErrorMessage(e, t('kiosk_load_failed')));
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // 30s auto-refresh + clock, visibility-aware.
  useEffect(() => {
    const tick = setInterval(() => {
      setNowMs(Date.now());
      if (!document.hidden && wcId && !dialogOpenRef.current) loadBoard(true);
    }, REFRESH_MS);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => { clearInterval(tick); clearInterval(clock); };
  }, [wcId, loadBoard]);

  // ─── Barcode wedge: invisible always-focused input ───────────────────
  useEffect(() => {
    const el = scanRef.current;
    if (!el) return undefined;
    const refocus = () => {
      if (!dialogOpenRef.current) setTimeout(() => el.focus(), 50);
    };
    el.focus();
    el.addEventListener('blur', refocus);
    return () => el.removeEventListener('blur', refocus);
  }, [wcId]);

  const handleScan = (raw) => {
    const code = String(raw || '').trim().toLowerCase();
    if (!code) return;
    const hit = workOrders.find((wo) => (
      [wo.code, wo.work_order_number, wo.production_order_number]
        .some((c) => c && String(c).trim().toLowerCase() === code)
    ));
    if (hit) {
      setScanMiss(null);
      setHighlightId(hit.id);
      cardRefs.current[hit.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightId((cur) => (cur === hit.id ? null : cur)), 4000);
    } else {
      setScanMiss(raw);
      setTimeout(() => setScanMiss(null), 4000);
    }
  };

  // ─── Actions ─────────────────────────────────────────────────────────
  const withBusy = async (woId, fn) => {
    setBusyIds((prev) => new Set(prev).add(woId));
    try {
      await fn();
      await loadBoard(true);
    } catch (e) {
      console.error('Kiosk action failed:', e);
      setBanner(getApiErrorMessage(e, t('kiosk_action_failed')));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(woId);
        return next;
      });
    }
  };

  const startWO = (wo) => withBusy(wo.id, () => workOrdersService.start(wo.id));
  const pauseWO = (wo) => withBusy(wo.id, () => workOrdersService.pause(wo.id));

  const openComplete = (wo) => {
    setCompleteWO(wo);
    setGood(String(wo.quantity_to_produce || 0));
    setScrap('0');
    setQc({ reason: '', text: '' });
  };

  const submitComplete = async () => {
    if (!completeWO) return;
    const goodQty = parseFloat(good) || 0;
    const scrapQty = parseFloat(scrap) || 0;
    if (goodQty <= 0) {
      setBanner(t('kiosk_qty_required'));
      return;
    }
    setSubmitting(true);
    try {
      const elapsedMin = completeWO.actual_start
        ? Math.max(0, Math.floor((Date.now() - new Date(completeWO.actual_start).getTime()) / 60000))
        : 0;
      await workOrdersService.complete(completeWO.id, {
        quantity_produced: goodQty,
        scrap_quantity: scrapQty,
        actual_duration: elapsedMin,
        notes: '',
      });
      if (scrapQty > 0) {
        // Non-fatal: the completion already posted; QC failure only banners.
        try {
          await workOrdersService.qualityCheck(completeWO.id, {
            quantity_inspected: goodQty + scrapQty,
            quantity_passed: goodQty,
            quantity_failed: scrapQty,
            defect_reason: composeDefectReason(t, qc.reason, qc.text),
          });
        } catch (qcErr) {
          console.error('Kiosk: quality check failed:', qcErr);
          setBanner(getApiErrorMessage(qcErr, t('kiosk_action_failed')));
        }
      }
      setCompleteWO(null);
      await loadBoard(true);
    } catch (e) {
      console.error('Kiosk: complete failed:', e);
      setBanner(getApiErrorMessage(e, t('kiosk_action_failed')));
    } finally {
      setSubmitting(false);
    }
  };

  const pickWC = (id) => {
    localStorage.setItem(WC_STORAGE_KEY, id);
    setWcId(id);
  };
  const changeWC = () => {
    localStorage.removeItem(WC_STORAGE_KEY);
    setWcId('');
    setWorkOrders([]);
  };
  const exitKiosk = () => navigate('/manufacturing?tab=execute&sub=shopfloor');

  const board = useMemo(
    () => [...workOrders].sort((a, b) => {
      const p = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (p !== 0) return p;
      return (a.sequence || 0) - (b.sequence || 0);
    }),
    [workOrders]
  );

  const clock = `${pad2(new Date(nowMs).getHours())}:${pad2(new Date(nowMs).getMinutes())}`;

  const statusLabel = (s) => {
    const key = `status_${s}`;
    const label = t(key);
    return label === key ? s : label;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Invisible barcode-wedge input */}
      <input
        ref={scanRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 w-px h-px pointer-events-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleScan(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />

      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-200 sticky top-0 z-20">
        <Factory className="w-7 h-7 text-slate-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xl font-bold text-slate-800 truncate">
            {wc ? wc.name : t('kiosk_pick_wc')}
          </p>
          {wc && (
            <button type="button" onClick={changeWC} className="text-sm text-blue-600 hover:underline">
              {t('kiosk_change_wc')}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-5">
          <span className="hidden sm:inline-flex items-center gap-2 text-sm text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${scanMiss ? 'bg-red-500' : 'bg-green-500'}`} />
            <ScanLine className="w-4 h-4" />
            {scanMiss ? `${t('kiosk_scan_not_found')}: ${scanMiss}` : t('kiosk_scanner_ready')}
          </span>
          <span className="text-3xl font-bold tabular-nums text-slate-800">{clock}</span>
          <button
            type="button"
            onClick={exitKiosk}
            className="min-h-[52px] px-5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-base font-semibold flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            {t('kiosk_exit')}
          </button>
        </div>
      </header>

      {/* Error banner — full-width, worker-visible */}
      {banner && (
        <div className="flex items-center gap-3 px-5 py-4 bg-red-600 text-white text-lg font-medium">
          <span className="flex-1">{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label={t('cancel')}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <main className="flex-1 p-5">
        {!wcId ? (
          /* Step 1 — work-center picker */
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-slate-200/60 animate-pulse" />
              ))}
            </div>
          ) : workCenters.length === 0 ? (
            <p className="text-center text-xl text-slate-500 py-24">{t('kiosk_wc_empty')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {workCenters.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => pickWC(w.id)}
                  className="h-36 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 flex flex-col items-center justify-center gap-3 transition-colors"
                >
                  <Cog className="w-10 h-10 text-slate-500" />
                  <span className="text-2xl font-bold text-slate-800 px-4 text-center leading-tight">{w.name}</span>
                </button>
              ))}
            </div>
          )
        ) : loading ? (
          /* Step 2 — board loading */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-52 rounded-2xl bg-slate-200/60 animate-pulse" />
            ))}
          </div>
        ) : board.length === 0 ? (
          <p className="text-center text-xl text-slate-500 py-24">{t('kiosk_no_orders')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {board.map((wo) => {
              const busy = busyIds.has(wo.id);
              const running = wo.status === 'in_progress';
              const paused = wo.status === 'paused';
              const highlighted = highlightId === wo.id;
              return (
                <div
                  key={wo.id}
                  ref={(el) => { cardRefs.current[wo.id] = el; }}
                  className={`rounded-2xl bg-white border-2 p-5 space-y-4 transition-colors ${
                    highlighted ? 'border-blue-500 ring-4 ring-blue-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-mono font-bold text-slate-800 truncate">
                        {wo.production_order_number || wo.code}
                        {wo.production_order_number && wo.code ? (
                          <span className="text-slate-400 font-normal"> · {wo.code}</span>
                        ) : null}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 truncate">{wo.product_name || wo.name}</p>
                      {wo.name && wo.product_name && (
                        <p className="text-base text-slate-500 truncate">{wo.name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${STATUS_STYLE[wo.status] || 'bg-slate-200 text-slate-700'}`}>
                        {statusLabel(wo.status)}
                      </span>
                      <p className="text-3xl font-bold tabular-nums text-slate-800 mt-2">
                        {wo.quantity_to_produce ?? 0}
                      </p>
                    </div>
                  </div>

                  {running && wo.actual_start && (
                    <p className="text-lg text-amber-700 font-semibold tabular-nums">
                      {t('kiosk_elapsed')}: {elapsedLabel(wo.actual_start, nowMs)}
                    </p>
                  )}

                  <div className="flex gap-3">
                    {(wo.status === 'pending' || wo.status === 'ready') && (
                      <BigButton tone="green" disabled={busy} onClick={() => startWO(wo)}>
                        <Play className="w-7 h-7" />
                        {t('kiosk_start')}
                      </BigButton>
                    )}
                    {paused && (
                      <BigButton tone="green" disabled={busy} onClick={() => startWO(wo)}>
                        <Play className="w-7 h-7" />
                        {t('kiosk_resume')}
                      </BigButton>
                    )}
                    {running && (
                      <BigButton tone="amber" disabled={busy} onClick={() => pauseWO(wo)}>
                        <Pause className="w-7 h-7" />
                        {t('kiosk_pause')}
                      </BigButton>
                    )}
                    {(running || paused) && (
                      <BigButton tone="blue" disabled={busy} onClick={() => openComplete(wo)}>
                        <CheckCircle2 className="w-7 h-7" />
                        {t('kiosk_complete')}
                      </BigButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* TOPSHIRISH dialog — full-screen, big controls */}
      <Dialog open={!!completeWO} onOpenChange={(open) => { if (!open) setCompleteWO(null); }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {t('kiosk_complete')}
              {completeWO && (
                <span className="block text-base font-normal text-slate-500 mt-1">
                  {(completeWO.production_order_number || completeWO.code)} · {completeWO.product_name || completeWO.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <Stepper label={t('kiosk_good_qty')} value={good} onChange={setGood} />
            <Stepper label={t('kiosk_scrap_qty')} value={scrap} onChange={setScrap} />

            {(parseFloat(scrap) || 0) > 0 && (
              <QCReasonPicker
                big
                reason={qc.reason}
                text={qc.text}
                onChange={setQc}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCompleteWO(null)}
                className="flex-1 min-h-[64px] rounded-2xl text-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitComplete}
                disabled={submitting || (parseFloat(good) || 0) <= 0}
                className="flex-1 min-h-[64px] rounded-2xl text-xl font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-7 h-7" />
                )}
                {t('kiosk_submit_confirm')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
