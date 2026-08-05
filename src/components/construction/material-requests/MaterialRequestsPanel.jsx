import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  ShoppingCart,
  AlarmClock,
  CheckCircle2,
  Search,
  Plus,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { StatTile, EmptyNote } from '@/components/shared/DashboardKit';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import { getApiErrorMessage } from '@/utils/apiError';
import materialRequestsService from '@/api/services/materialRequests';

import { mrStatusBadgeProps, MR_STATUS_META } from './materialRequestMeta';
import MaterialRequestFormModal from './MaterialRequestFormModal';
import MaterialRequestDetailSheet from './MaterialRequestDetailSheet';

// Material zayavkalari paneli — uch rejimda ishlaydi:
//   mode="construction" — Qurilish moduli sahifa-tab (barcha loyihalar)
//   mode="project"      — loyiha detalidagi «Materiallar» tabi (projectId shart)
//   mode="warehouse"    — Ombor «Kiruvchi zayavkalar» inboxi (omborchi amallari)
export default function MaterialRequestsPanel({ mode = 'construction', projectId = null }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const isWarehouse = mode === 'warehouse';
  // Prorab (construction can_create) zayavka yarata oladi.
  const mayCreate = canCreate(MODULES.CONSTRUCTION);
  // Omborchi amallari — inventory can_update (backendda inventory:stock:adjust).
  const mayWarehouseAct = canUpdate(MODULES.INVENTORY);

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(isWarehouse ? 'inbox' : 'open');

  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {};
      if (projectId) params.project_id = projectId;
      if (debouncedSearch) params.q = debouncedSearch;
      if (statusFilter === 'open') params.open = 'true';
      else if (statusFilter === 'inbox') params.status = 'new,in_review,in_purchase,partially_fulfilled';
      else if (statusFilter === 'overdue') params.overdue = 'true';
      else if (statusFilter !== 'all') params.status = statusFilter;
      const [list, st] = await Promise.all([
        materialRequestsService.list(params),
        materialRequestsService.stats(projectId ? { project_id: projectId } : {}).catch(() => null),
      ]);
      setRequests(Array.isArray(list) ? list : []);
      setStats(st);
    } catch (e) {
      setLoadError(getApiErrorMessage(e, t('mr_load_failed') || 'Zayavkalarni yuklab bo‘lmadi'));
    } finally {
      setLoading(false);
    }
    // `t` ataylab deps'da EMAS: useTranslation har renderda yangi closure
    // qaytaradi — deps'ga qo'shilsa loadData har render qayta yaratilib,
    // useEffect cheksiz so'rov tsikliga tushadi (429 rate-limit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, debouncedSearch, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Bildirishnoma deep-link: ?mrId=… kelganda detal ochiladi.
  useEffect(() => {
    const mrId = searchParams.get('mrId');
    if (mrId) {
      setDetailId(Number(mrId));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('mrId');
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = useMemo(() => ([
    {
      key: 'open',
      label: t('mr_stat_open') || 'Ochiq zayavkalar',
      value: stats?.open_count ?? '—',
      sub: stats?.urgent_open ? `${stats.urgent_open} ${t('mr_stat_urgent') || 'shoshilinch'}` : null,
      icon: ClipboardList,
      chip: 'bg-blue-50 text-blue-600',
      filter: 'open',
    },
    {
      key: 'in_purchase',
      label: t('mr_stat_in_purchase') || 'Xaridda',
      value: stats?.in_purchase_count ?? '—',
      icon: ShoppingCart,
      chip: 'bg-orange-50 text-orange-600',
      filter: 'in_purchase',
    },
    {
      key: 'overdue',
      label: t('mr_stat_overdue') || 'Kechikayotgan',
      value: stats?.overdue_count ?? '—',
      icon: AlarmClock,
      chip: 'bg-red-50 text-red-600',
      valueCls: stats?.overdue_count > 0 ? 'text-red-600' : undefined,
      filter: 'overdue',
    },
    {
      key: 'closed',
      label: t('mr_stat_closed_month') || 'Bu oy yopilgan',
      value: stats?.closed_this_month ?? '—',
      sub: stats?.avg_fulfillment_hours
        ? `${t('mr_stat_avg') || "O'rtacha"}: ${Math.round(stats.avg_fulfillment_hours)} ${t('mr_hours') || 'soat'}`
        : null,
      icon: CheckCircle2,
      chip: 'bg-emerald-50 text-emerald-600',
      filter: 'closed',
    },
  ]), [stats, t]);

  const openDetail = (id) => setDetailId(id);

  const handleCreated = () => {
    setShowForm(false);
    setFormInitial(null);
    loadData();
  };

  const handleCopy = (request) => {
    // Rad etilgan zayavkani nusxalab qayta yuborish — forma old yozuvlar
    // bilan to'ldiriladi (3.4-stsenariy).
    setFormInitial(request);
    setDetailId(null);
    setShowForm(true);
  };

  const statusOptions = [
    { value: isWarehouse ? 'inbox' : 'open', label: isWarehouse ? (t('mr_filter_inbox') || 'Kiruvchi') : (t('mr_filter_open') || 'Ochiq') },
    { value: 'all', label: t('all_statuses') || 'Barcha holatlar' },
    // Stat-karta ham shu filterga o'tkazadi — Select bo'sh ko'rinmasligi
    // uchun ro'yxatda bo'lishi shart.
    { value: 'overdue', label: t('mr_stat_overdue') || 'Kechikayotgan' },
    ...Object.keys(MR_STATUS_META).map((s) => ({ value: s, label: mrStatusBadgeProps(s, t).label })),
  ];

  return (
    <div className="space-y-5">
      {/* Stat-kartalar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <StatTile
            key={card.key}
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            chip={card.chip}
            valueCls={card.valueCls}
            onClick={() => setStatusFilter(card.filter)}
          />
        ))}
      </div>

      {/* Qidiruv + filter + yangi zayavka */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mr_search_placeholder') || 'Zayavka, loyiha yoki material qidirish...'}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isWarehouse && mayCreate && (
          <Button
            onClick={() => { setFormInitial(projectId ? { project_id: projectId } : null); setShowForm(true); }}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-md hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('mr_new_request') || 'Zayavka tashlash'}
          </Button>
        )}
      </div>

      {/* Ro'yxat */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            {t('retry') || 'Qayta urinish'}
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyNote
            icon={ClipboardList}
            text={t('mr_empty') || "Hali zayavka yo'q — obyekt uchun material kerak bo'lsa, zayavka tashlang"}
            cta={!isWarehouse && mayCreate ? (
              <Button size="sm" onClick={() => { setFormInitial(projectId ? { project_id: projectId } : null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('mr_new_request') || 'Zayavka tashlash'}
              </Button>
            ) : null}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Desktop jadval / mobil karta — bitta ro'yxat, responsive satrlar */}
          <div className="hidden md:grid grid-cols-[130px_1fr_1.4fr_110px_150px_90px] gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>№</span>
            <span>{t('project') || 'Loyiha'}</span>
            <span>{t('mr_materials') || 'Materiallar'}</span>
            <span>{t('mr_needed_by') || 'Kerak sana'}</span>
            <span>{t('status') || 'Holat'}</span>
            <span>{t('mr_age') || 'Yoshi'}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => {
              const badge = mrStatusBadgeProps(r.status, t);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(r.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                      r.is_overdue ? 'border-l-2 border-l-red-500' : ''
                    }`}
                  >
                    <div className="md:grid md:grid-cols-[130px_1fr_1.4fr_110px_150px_90px] md:gap-3 md:items-center flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                        {r.priority === 'urgent' && (
                          <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" title={t('mr_urgent') || 'Shoshilinch'} />
                        )}
                        {r.request_number}
                      </div>
                      <div className="text-sm text-slate-600 truncate">{r.project_name}</div>
                      <div className="text-xs text-slate-500 truncate" title={r.items_summary}>
                        {r.items_summary || `${r.item_count} ${t('mr_items_count') || 'qator'}`}
                      </div>
                      <div className={`text-xs ${r.is_overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        {r.required_date ? String(r.required_date).slice(0, 10) : '—'}
                        {r.is_overdue && (
                          <span className="ml-1">({t('mr_overdue') || 'kechikmoqda'})</span>
                        )}
                      </div>
                      <div>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.age_days} {t('mr_days') || 'kun'}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Yangi zayavka formasi */}
      {showForm && (
        <MaterialRequestFormModal
          open={showForm}
          onClose={() => { setShowForm(false); setFormInitial(null); }}
          onCreated={handleCreated}
          initial={formInitial}
          fixedProjectId={projectId}
        />
      )}

      {/* Detal sheet */}
      {detailId != null && (
        <MaterialRequestDetailSheet
          requestId={detailId}
          mode={mode}
          canWarehouseAct={mayWarehouseAct}
          onClose={() => setDetailId(null)}
          onChanged={loadData}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}
