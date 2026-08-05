import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Send,
  Flame,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { getApiErrorMessage } from '@/utils/apiError';
import materialRequestsService from '@/api/services/materialRequests';
import { inventoryService } from '@/api/services/inventory';
import { constructionService } from '@/api/services/construction';

const RECENT_KEY = 'genix_mr_recent_products';

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(products) {
  try {
    const prev = readRecent();
    const merged = [...products, ...prev.filter((p) => !products.some((n) => n.id === p.id))];
    localStorage.setItem(RECENT_KEY, JSON.stringify(merged.slice(0, 8)));
  } catch { /* localStorage yo'q — jim */ }
}

// Jonli qoldiq chipi: 🟢 yetarli · 🟡 qisman · 🔴 yo'q
function StockChip({ line, t }) {
  if (line.onHand == null) {
    return <span className="text-[11px] text-slate-400">…</span>;
  }
  const qty = Number(line.qty) || 0;
  if (line.onHand <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {t('mr_stock_none') || "Omborda yo'q"}
      </span>
    );
  }
  if (qty > 0 && line.onHand < qty) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {t('mr_stock_partial') || 'Qisman'}: {line.onHand}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {t('mr_stock_available') || 'Omborda'}: {line.onHand}
    </span>
  );
}

// «Yangi zayavka» — mobile-first 3 qadam: Materiallar → Tafsilot → Yuborish.
// initial: nusxalash (rad etilgan zayavkadan) yoki { project_id } prefill.
export default function MaterialRequestFormModal({ open, onClose, onCreated, initial = null, fixedProjectId = null }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(
    String(fixedProjectId || initial?.project_id || '')
  );
  const [requiredDate, setRequiredDate] = useState(initial?.required_date ? String(initial.required_date).slice(0, 10) : '');
  const [priority, setPriority] = useState(initial?.priority || 'normal');
  const [notes, setNotes] = useState('');

  // lines: {key, product_id, name, unit, qty, onHand}
  const [lines, setLines] = useState(() =>
    (initial?.items || []).map((it, i) => ({
      key: `init-${i}`,
      product_id: it.product_id,
      name: it.product_name || it.name,
      unit: it.unit || '',
      qty: it.qty_requested || it.qty || 1,
      onHand: null,
    }))
  );

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recent] = useState(readRecent);
  const searchTimer = useRef(null);

  // Loyihalar (fixedProjectId bo'lmasa) — kontekstga bog'lanmasdan yuklanadi,
  // chunki forma Ombor sahifasida ham ochilishi mumkin.
  useEffect(() => {
    if (!open || fixedProjectId) return;
    constructionService.listProjects()
      .then((data) => setProjects(Array.isArray(data) ? data : (data?.items || [])))
      .catch(() => setProjects([]));
  }, [open, fixedProjectId]);

  // Mahsulot qidiruvi (200ms debounce)
  useEffect(() => {
    if (!productQuery.trim()) {
      setProductResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await inventoryService.listProducts({ search: productQuery.trim(), limit: 8 });
        const list = Array.isArray(data) ? data : (data?.items || []);
        setProductResults(list.slice(0, 8));
      } catch {
        setProductResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(searchTimer.current);
  }, [productQuery]);

  // Jonli qoldiq — qatorlar/loyiha o'zgarganda yangilanadi.
  const refreshStock = useCallback(async (currentLines, pid) => {
    const ids = currentLines.map((l) => l.product_id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const data = await materialRequestsService.stockCheck({
        productIds: ids,
        projectId: pid || undefined,
      });
      const map = {};
      (data?.items || []).forEach((r) => { map[r.product_id] = r; });
      setLines((prev) => prev.map((l) => ({
        ...l,
        onHand: map[l.product_id] ? map[l.product_id].on_hand : l.onHand,
      })));
    } catch { /* indikator ixtiyoriy — xatoda jim */ }
  }, []);

  useEffect(() => {
    if (open && lines.length > 0) refreshStock(lines, projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, lines.length]);

  const addProduct = (p) => {
    if (lines.some((l) => l.product_id === p.id)) {
      toast.info(t('mr_already_added') || "Bu material allaqachon qo'shilgan");
      return;
    }
    const line = {
      key: `${p.id}-${Date.now()}`,
      product_id: p.id,
      name: p.name,
      unit: p.unit_name || p.unit || '',
      qty: 1,
      onHand: null,
    };
    setLines((prev) => [...prev, line]);
    setProductQuery('');
    setProductResults([]);
  };

  const updateQty = (key, qty) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  };

  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const validLines = useMemo(
    () => lines.filter((l) => l.product_id && Number(l.qty) > 0),
    [lines]
  );

  const canNext = step === 1 ? validLines.length > 0 : step === 2 ? !!projectId : true;

  const quickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setRequiredDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        project_id: Number(projectId),
        required_date: requiredDate || undefined,
        priority,
        notes,
        items: validLines.map((l) => ({
          product_id: l.product_id,
          qty: Number(l.qty),
          unit: l.unit,
        })),
      };
      const created = await materialRequestsService.create(payload);
      pushRecent(validLines.map((l) => ({ id: l.product_id, name: l.name, unit_name: l.unit })));
      toast.success(
        `${t('mr_created_toast') || 'Zayavka yuborildi'}: ${created?.request_number || ''}`
      );
      onCreated?.(created);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('mr_create_failed') || "Zayavka yuborib bo'lmadi"));
    } finally {
      setSubmitting(false);
    }
  };

  const projectName = useMemo(() => {
    if (fixedProjectId) return null;
    const p = projects.find((x) => String(x.id) === String(projectId));
    return p?.name || '';
  }, [projects, projectId, fixedProjectId]);

  const STEPS = [
    t('mr_step_materials') || 'Materiallar',
    t('mr_step_details') || 'Tafsilot',
    t('mr_step_review') || 'Yuborish',
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-semibold">
            {t('mr_new_request') || 'Zayavka tashlash'}
          </DialogTitle>
          {/* Qadam indikatori */}
          <div className="flex items-center gap-2 mt-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                    step > i + 1
                      ? 'bg-emerald-100 text-emerald-700'
                      : step === i + 1
                        ? 'bg-[var(--genix-blue)] text-white'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-xs ${step === i + 1 ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="w-4 h-px bg-slate-200" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── 1-qadam: materiallar ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t('mr_search_material') || 'Material qidirish...'}
                  className="pl-9 h-11"
                  autoFocus
                />
                {(productResults.length > 0 || searching) && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    {searching && (
                      <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('searching') || 'Qidirilmoqda...'}
                      </div>
                    )}
                    {!searching && productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <span className="text-sm text-slate-800 truncate">{p.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{p.unit_name || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {recent.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    {t('mr_recent_products') || 'Oxirgi ishlatilganlar'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="px-2.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:border-[var(--genix-blue)] hover:text-[var(--genix-blue)] transition-colors"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {lines.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  {t('mr_add_materials_hint') || "Qidiruv orqali material qo'shing"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li key={l.key} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
                          <StockChip line={l} t={t} />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={l.qty}
                          onChange={(e) => updateQty(l.key, e.target.value)}
                          className="h-10 w-28 text-base"
                        />
                        <span className="text-sm text-slate-500">{l.unit || '—'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── 2-qadam: tafsilot ── */}
          {step === 2 && (
            <div className="space-y-4">
              {!fixedProjectId && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    {t('project') || 'Loyiha'} *
                  </label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('mr_select_project') || 'Loyihani tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {t('mr_needed_by') || 'Kerak sana'}
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => quickDate(0)}>
                    {t('today') || 'Bugun'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => quickDate(1)}>
                    {t('tomorrow') || 'Ertaga'}
                  </Button>
                  <Input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="h-10 flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {t('mr_priority') || 'Ustuvorlik'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('normal')}
                    className={`h-11 rounded-xl border text-sm font-medium transition-colors ${
                      priority === 'normal'
                        ? 'border-[var(--genix-blue)] bg-blue-50/60 text-[var(--genix-blue)]'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t('mr_priority_normal') || 'Oddiy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('urgent')}
                    className={`h-11 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      priority === 'urgent'
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    {t('mr_priority_urgent') || 'Shoshilinch'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {t('notes') || 'Izoh'}
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('mr_notes_placeholder') || "Qo'shimcha ma'lumot (ixtiyoriy)"}
                />
              </div>
            </div>
          )}

          {/* ── 3-qadam: ko'rib chiqish ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-sm">
                {!fixedProjectId && (
                  <p><span className="text-slate-500">{t('project') || 'Loyiha'}:</span> <span className="font-medium">{projectName}</span></p>
                )}
                <p>
                  <span className="text-slate-500">{t('mr_needed_by') || 'Kerak sana'}:</span>{' '}
                  <span className="font-medium">{requiredDate || '—'}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-slate-500">{t('mr_priority') || 'Ustuvorlik'}:</span>{' '}
                  {priority === 'urgent' ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-600">
                      <Flame className="w-3.5 h-3.5" /> {t('mr_priority_urgent') || 'Shoshilinch'}
                    </span>
                  ) : (
                    <span className="font-medium">{t('mr_priority_normal') || 'Oddiy'}</span>
                  )}
                </p>
                {notes && <p><span className="text-slate-500">{t('notes') || 'Izoh'}:</span> {notes}</p>}
              </div>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {validLines.map((l) => (
                  <li key={l.key} className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate">{l.name}</p>
                      <StockChip line={l} t={t} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 shrink-0">
                      {l.qty} {l.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pastki tugmalar — katta touch-target */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button type="button" variant="outline" className="h-11" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('back') || 'Orqaga'}
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              disabled={!canNext}
              className="h-11 flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              onClick={() => setStep(step + 1)}
            >
              {t('next') || 'Keyingi'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={submitting || validLines.length === 0 || !projectId}
              className="h-11 flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {t('mr_submit') || 'Yuborish'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
