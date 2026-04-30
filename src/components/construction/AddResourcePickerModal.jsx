import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';

// AddResourcePickerModal — faithful port of the Form2_Works_v2 mockup's
// "Qo'shimcha resurs qo'shish" modal.
//
// Built directly on Radix Dialog primitives (no shadcn wrapper) so we
// own every CSS rule on the dialog content — no `w-full max-w-lg`
// defaults to fight, full pixel control via inline style.

// Up to 6 fractional digits with trailing zeros dropped — keeps
// imported per-unit prices and small norm rates from being silently
// truncated to 2 decimals.
const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 })
    .format(v).replace(/\u00A0/g, ' ');
};

// Money input helpers — render the raw numeric string with thin-space
// thousand grouping while keeping the underlying state digits-only so
// parseNum() at submit stays correct. Both decimal point and comma are
// accepted; only the first decimal is kept.
const formatAmountForInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
  const [intPart, decPart] = cleaned.split('.');
  const grouped = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
};
const stripAmountInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};
const parseNum = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')) || 0;

const CAT_TAG = {
  labor:     { bg: 'rgba(245,158,11,0.1)',  fg: '#F59E0B', label: 'MEHNAT' },
  equipment: { bg: 'rgba(167,139,250,0.1)',  fg: '#A78BFA', label: 'MASHINA' },
  material:  { bg: 'rgba(20,184,166,0.1)',  fg: '#14B8A6', label: 'MATERIAL' },
};

function classify(rt) {
  rt = String(rt || '').toLowerCase();
  if (['labor', 'ish', 'ishchi', 'worker'].includes(rt)) return 'labor';
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'equipment';
  return 'material';
}

export default function AddResourcePickerModal({ open, onClose, projectId, estimateId, parent, nextSeq, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rate, setRate] = useState('1');
  const [totalQty, setTotalQty] = useState('0');
  const [saving, setSaving] = useState(false);

  // ── Inline "create new resource" form ─────────────────────────────
  // Toggled by the "+" button next to the search input. Lets the user
  // define a new resource (labour/machine/material) when the smeta
  // didn't include it. Material types also auto-create an inventory
  // product on the backend so the warehouse reservation flow has
  // something to bind to.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    uom: '',
    resource_type: 'material',
    unit_price: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch(''); setSelected(null); setRate('1'); setTotalQty('0');
      setCreateOpen(false);
      setCreateForm({ name: '', uom: '', resource_type: 'material', unit_price: '' });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.listEstimateResources(projectId)
      .then((rows) => { if (!cancelled) setResources(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setResources([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let xs = resources;
    if (q) {
      xs = xs.filter((r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.uom  || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q),
      );
    }
    return xs.slice(0, 60);
  }, [resources, search]);

  // Distinct unit-of-measure list, sourced from the resources already
  // imported into this project's estimates. Powers the O'lchov dropdown
  // in the inline "create new resource" form so foremen don't have to
  // remember the exact spelling/casing the smeta uses (e.g. "ЧЕЛ.-Ч"
  // vs "chel-soat") — picking from this list keeps new rows consistent
  // with the imported smeta and avoids near-duplicate UOMs piling up.
  // Dedupe is case-insensitive on the trimmed value; we keep the first
  // casing seen so the dropdown shows the actual imported labels.
  const uomOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const r of resources || []) {
      const raw = String(r?.uom || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
    }
    out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return out;
  }, [resources]);

  const pickedPrice = useMemo(() => {
    if (!selected) return 0;
    const rt = String(selected.resource_type || '').toLowerCase();
    if (rt === 'labor')     return Number(selected.labor_rate)     || Number(selected.unit_rate) || 0;
    if (rt === 'equipment') return Number(selected.equipment_rate) || Number(selected.unit_rate) || 0;
    if (rt === 'material')  return Number(selected.material_rate)  || Number(selected.unit_rate) || 0;
    return Number(selected.unit_rate) || 0;
  }, [selected]);

  const summa = useMemo(() => pickedPrice * parseNum(totalQty), [pickedPrice, totalQty]);

  // Submit the inline "create new resource" form. On success the modal
  // refetches its resource list and auto-selects the new entry so the
  // user can proceed straight to entering norm + qty without scrolling.
  const handleCreate = useCallback(async () => {
    const name = String(createForm.name || '').trim();
    if (!name) {
      toast.error(t('name_required') || "Nomini kiriting");
      return;
    }
    setCreating(true);
    try {
      const created = await constructionService.createProjectResource(projectId, {
        name,
        uom: String(createForm.uom || '').trim(),
        resource_type: createForm.resource_type || 'material',
        unit_price: parseNum(createForm.unit_price),
      });
      // Refresh the catalog so the new row appears.
      const data = await constructionService.listEstimateResources(projectId);
      const list = Array.isArray(data) ? data : [];
      setResources(list);
      // Auto-select the new resource (match by name + uom since the
      // create endpoint may have deduped against an existing entry).
      const match = list.find((r) =>
        String(r.name || '').toUpperCase() === name.toUpperCase() &&
        String(r.uom || '') === String(created?.uom || '')
      );
      if (match) setSelected(match);
      setCreateOpen(false);
      toast.success(t('resource_created') || "Resurs qo'shildi");
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setCreating(false);
    }
  }, [projectId, createForm, t]);

  const handleConfirm = useCallback(async () => {
    if (!selected || !parent) return;
    const r = parseNum(rate);
    // Total Qty is optional. When the user enters one we send it as
    // a manual override so the row carries that exact quantity. When
    // they leave it blank, we DON'T override — the backend then
    // computes quantity = parent.quantity × norm_rate (cascade
    // rule), which is what the user expects: a fresh resource added
    // with just a norma should auto-respect the work's qty (e.g.
    // norma 10 on a work with qty 21 → JAMI = 210), not stay 0.
    const tq = parseNum(totalQty);
    const overrideQty = tq > 0;
    setSaving(true);
    try {
      const parentNum = parent.item_number || String(parent.id || '');
      const payload = {
        parent_line_id: parent.id,
        name: selected.name,
        uom: selected.uom || parent.uom || '',
        resource_type: String(selected.resource_type || 'material').toLowerCase(),
        norm_rate: r,
        unit_price: pickedPrice,
        item_number: parentNum ? `${parentNum}-${nextSeq || 1}` : undefined,
        quantity_override: overrideQty,
      };
      // Only send quantity when the user typed one — otherwise let
      // the backend cascade from parent.qty × norm_rate.
      if (overrideQty) payload.quantity = tq;
      await constructionService.createEstimateLine(estimateId, payload);
      toast.success(t('added') || "Qo'shildi");
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  }, [selected, parent, rate, totalQty, pickedPrice, estimateId, nextSeq, onSaved, onClose, t]);

  if (!parent) return null;
  const parentLabel = `#${parent.item_number || parent.id} · ${(parent.name || '').slice(0, 60)}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: "rgba(15,23,42,0.4)",
            backdropFilter: 'blur(4px)',
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            // Light-theme rewrite — was a dark-mode panel (#1E293B / #0B1220)
            // matching the v2 mockup, but the rest of the construction module
            // is on a white surface and the user asked for the modals to
            // match. Palette now mirrors the rest of the Smeta boshqaruvi
            // page: white surface, slate-200 border, slate-900 text.
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100vw - 32px)',
            maxWidth: 760,
            maxHeight: 'calc(100vh - 64px)',
            zIndex: 101,
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
          }}
        >
          {/* Head */}
          <div
            className="px-6 py-5 flex justify-between items-start gap-4"
            style={{ borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em] mb-1" style={{ color: '#64748B' }}>
                {t('add_extra_resource_title') || "Qo'shimcha resurs qo'shish"}
              </div>
              <DialogPrimitive.Title className="text-base font-semibold truncate" title={parentLabel} style={{ color: '#0F172A' }}>
                {parentLabel}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 hover:bg-slate-50"
              style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body — scrolls when content exceeds available height */}
          <div className="px-6 py-5" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div className="mb-4">
              <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                {t('pick_resource') || 'Resursni tanlang'}
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('search_resource_by_name') || "Resurs nomi bo'yicha qidirish..."}
                    className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none focus:border-teal-500"
                    style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                    autoFocus
                  />
                </div>
                {/* New-resource toggle. Opens an inline form so the foreman
                   can define a resource that's missing from the smeta —
                   labour entry, machine, or material. Material types also
                   auto-create an inventory product on the backend. */}
                <button
                  type="button"
                  onClick={() => setCreateOpen((v) => !v)}
                  title={t('create_new_resource') || "Yangi resurs yaratish"}
                  className="px-3 rounded-md flex items-center justify-center"
                  style={{
                    background: createOpen ? '#14B8A6' : '#FFFFFF',
                    color: createOpen ? '#FFFFFF' : '#14B8A6',
                    border: '1px solid #14B8A6',
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline create form. */}
            {createOpen && (
              <div
                className="mb-4 p-3 rounded-lg"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="col-span-2">
                    <label className="text-[10.5px] block mb-1" style={{ color: '#64748B' }}>
                      {t('resource_name') || 'Resurs nomi'}
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t('resource_name_placeholder') || "Masalan: AVTOBETONONASOSY 65 М3/Ч"}
                      className="w-full px-3 py-2 rounded text-[12.5px] outline-none"
                      style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] block mb-1" style={{ color: '#64748B' }}>
                      {t('unit') || "O'lchov"}
                    </label>
                    {/* Custom combobox replacing the previous native
                        <datalist>. The browser's datalist popup
                        position is uncontrollable — Chrome on macOS
                        was opening it above the modal, sometimes
                        clipped at the top of the viewport. This
                        custom dropdown always opens directly below
                        the input via position: absolute. Free-text
                        input is preserved (foreman can type a unit
                        the smeta doesn't have). */}
                    <UomCombobox
                      value={createForm.uom}
                      onChange={(v) => setCreateForm((f) => ({ ...f, uom: v }))}
                      options={uomOptions}
                      placeholder={
                        uomOptions.length > 0
                          ? `${t('select_or_type') || 'Tanlang yoki kiriting'}…`
                          : (t('unit_placeholder') || "м3, шт, ЧЕЛ.-Ч…")
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] block mb-1" style={{ color: '#64748B' }}>
                      {t('type') || 'Tur'}
                    </label>
                    <select
                      value={createForm.resource_type}
                      onChange={(e) => setCreateForm((f) => ({ ...f, resource_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded text-[12.5px] outline-none cursor-pointer"
                      style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                    >
                      <option value="material">{t('mat_type_material') || 'Material'}</option>
                      <option value="equipment">{t('mat_type_equipment') || 'Mashina'}</option>
                      <option value="labor">{t('mat_type_labor') || 'Mehnat'}</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10.5px] block mb-1" style={{ color: '#64748B' }}>
                      {t('unit_price') || 'Birlik narxi'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatAmountForInput(createForm.unit_price)}
                      onChange={(e) => setCreateForm((f) => ({ ...f, unit_price: stripAmountInput(e.target.value) }))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded text-[12.5px] font-mono outline-none"
                      style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                    />
                  </div>
                </div>
                {createForm.resource_type === 'material' && (
                  <div className="text-[10.5px] mb-2" style={{ color: '#B45309' }}>
                    📦 {t('material_inventory_note') || "Material turidagi resurs Mahsulotlar (Inventar) ro'yxatiga ham qo'shiladi"}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    disabled={creating}
                    className="px-3 py-1.5 rounded text-[11.5px] disabled:opacity-50"
                    style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1' }}
                  >
                    {t('cancel') || 'Bekor qilish'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating || !String(createForm.name || '').trim()}
                    className="px-3 py-1.5 rounded text-[11.5px] font-medium flex items-center gap-1.5 disabled:opacity-50"
                    style={{ background: '#14B8A6', color: '#FFFFFF', border: 'none' }}
                  >
                    {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t('create') || 'Yaratish'}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loading ? (
                <div className="py-8 text-center" style={{ color: '#64748B' }}>
                  <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                  {t('loading') || 'Yuklanmoqda…'}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: '#64748B' }}>
                  {t('no_resources_found') || 'Hech narsa topilmadi'}
                </div>
              ) : (
                filtered.map((r) => {
                  const cat = classify(r.resource_type);
                  const tag = CAT_TAG[cat];
                  const rt = String(r.resource_type || '').toLowerCase();
                  const price = rt === 'labor' ? r.labor_rate
                    : rt === 'equipment' ? r.equipment_rate
                    : rt === 'material' ? r.material_rate
                    : r.unit_rate || 0;
                  const isSelected = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full mb-1.5 px-3 py-2.5 rounded-md grid items-center gap-3 transition text-left hover:bg-slate-50"
                      style={{
                        background: isSelected ? 'rgba(20,184,166,0.06)' : '#FFFFFF',
                        border: `1px solid ${isSelected ? '#14B8A6' : '#E2E8F0'}`,
                        gridTemplateColumns: '90px 1fr 80px 130px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                        style={{ background: tag.bg, color: tag.fg, justifySelf: 'start' }}
                      >
                        {tag.label}
                      </span>
                      <span className="truncate" style={{ color: '#0F172A' }} title={r.name}>{r.name}</span>
                      <span className="text-center" style={{ color: '#475569' }}>{r.uom || ''}</span>
                      <span className="text-right font-mono tabular-nums" style={{ color: '#D97706' }}>{fmt(price)}</span>
                    </button>
                  );
                })
              )}
            </div>

            {selected && (
              <div
                className="rounded-lg p-4"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                  {t('selected_resource') || 'Tanlangan resurs'}
                </label>
                <div
                  className="px-3 py-2.5 rounded text-[13px] mb-4 flex items-center gap-2"
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                >
                  {(() => {
                    const cat = classify(selected.resource_type);
                    const tag = CAT_TAG[cat];
                    return (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                        style={{ background: tag.bg, color: tag.fg }}
                      >
                        {tag.label}
                      </span>
                    );
                  })()}
                  <span className="truncate" title={selected.name} style={{ color: '#0F172A' }}>{selected.name}</span>
                  <span className="text-[12px]" style={{ color: '#64748B' }}>
                    ({selected.uom || ''} · {fmt(pickedPrice)} so'm)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                      {t('norma_per_unit') || 'Norma (bir birlik uchun)'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                      style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                      {t('total_qty') || 'Jami miqdor'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={totalQty}
                      onChange={(e) => setTotalQty(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                      style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                    />
                  </div>
                </div>

                <div
                  className="px-3 py-3 rounded-md flex justify-between items-center font-mono text-[12px]"
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                >
                  <span style={{ color: '#64748B' }}>{t('amount') || 'Summa'}:</span>
                  <span style={{ color: '#D97706', fontWeight: 600 }}>{fmt(summa)} so'm</span>
                </div>
              </div>
            )}
          </div>

          {/* Foot */}
          <div
            className="px-6 py-4 flex justify-end gap-2.5"
            style={{ borderTop: '1px solid #E2E8F0', flexShrink: 0 }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs disabled:opacity-50"
              style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1' }}
            >
              {t('cancel') || 'Bekor qilish'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected || saving}
              className="px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#14B8A6', color: '#FFFFFF', border: 'none' }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('add') || "Qo'shish"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// UomCombobox — a self-contained text input + popdown list anchored
// directly below the input. Replaces the native HTML <datalist> whose
// popup position is browser-controlled (Chrome on macOS was opening
// it above the modal, sometimes clipped). The list filters by what
// the user has typed and accepts free text on Enter/blur, so the
// foreman can still enter a unit the smeta doesn't have.
function UomCombobox({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close when the user clicks outside the wrapper. Pointerdown so
  // we close BEFORE any click on a list row gets a chance to fire —
  // the list rows have their own onMouseDown handlers (see below).
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  // Filter options by the typed text — case-insensitive substring.
  // When the field is empty we show every option so the dropdown
  // works as a plain "pick one" list on first focus.
  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => String(u || '').toLowerCase().includes(q));
  }, [value, options]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded text-[12.5px] outline-none"
        style={{
          background: '#FFFFFF',
          color: '#0F172A',
          border: '1px solid #CBD5E1',
          fontFamily: 'inherit',
        }}
      />
      {open && filtered.length > 0 && (
        <ul
          // Absolute-positioned, anchored directly under the input.
          // z-index keeps it above other modal content; max-height +
          // overflow-y prevents it from blowing up the modal when the
          // project has 50+ unique UOMs.
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            maxHeight: 220,
            overflowY: 'auto',
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
          }}
        >
          {filtered.map((u) => (
            <li
              key={u}
              // onMouseDown (not onClick) so the input's blur doesn't
              // close the dropdown before we get a chance to fire.
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(u);
                setOpen(false);
              }}
              className="px-3 py-1.5 text-[12.5px] cursor-pointer"
              style={{ color: '#0F172A' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {u}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
