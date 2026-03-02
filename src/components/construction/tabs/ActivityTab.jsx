import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Package,
  Camera,
  Users,
  Clock,
  Layers,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

// Translates hardcoded Uzbek descriptions stored in the DB into the current UI language.
// Patterns match the fmt.Sprintf templates used in the Go backend.
const translateActivityDesc = (desc, t) => {
  if (!desc) return desc;

  // Exact matches first
  const exact = {
    'Smeta tasdiqlandi': 'act_estimate_approved',
    "Smeta o'chirildi": 'act_estimate_deleted',
    "WBS band o'chirildi": 'act_wbs_deleted',
    "Kunlik yozuv o'chirildi": 'act_daily_log_deleted',
  };
  if (exact[desc]) return t(exact[desc]);

  // Prefix patterns with dynamic parts preserved
  if (desc.startsWith('Bosqich yaratildi: ')) {
    return `${t('act_stage_created')}: ${desc.slice('Bosqich yaratildi: '.length)}`;
  }
  if (desc.startsWith('Smeta yaratildi: ')) {
    return `${t('act_estimate_created')}: ${desc.slice('Smeta yaratildi: '.length)}`;
  }
  if (desc.startsWith('Smeta nusxalandi: ')) {
    return `${t('act_estimate_copied')}: ${desc.slice('Smeta nusxalandi: '.length)}`;
  }
  if (desc.startsWith('WBS yaratildi: ')) {
    return `${t('act_wbs_created')}: ${desc.slice('WBS yaratildi: '.length)}`;
  }
  if (desc.startsWith('Xarajat yaratildi: ')) {
    return `${t('act_expense_created')}: ${desc.slice('Xarajat yaratildi: '.length)}`;
  }
  if (desc.startsWith('Xarajat tasdiqlandi: ')) {
    return `${t('act_expense_approved')}: ${desc.slice('Xarajat tasdiqlandi: '.length)}`;
  }
  if (desc.startsWith('Xarajat bekor qilindi: ')) {
    return `${t('act_expense_cancelled')}: ${desc.slice('Xarajat bekor qilindi: '.length)}`;
  }
  if (desc.startsWith('Kunlik yozuv: ')) {
    // "Kunlik yozuv: 1122.00 m bajarildi" → "Daily log: 1122.00 m completed"
    const inner = desc.slice('Kunlik yozuv: '.length).replace(' bajarildi', ` ${t('act_completed')}`);
    return `${t('act_daily_log')}: ${inner}`;
  }
  if (desc.startsWith('Loyiha foydalanishga topshirildi')) {
    const suffix = desc.slice('Loyiha foydalanishga topshirildi'.length);
    return `${t('act_project_commissioned')}${suffix}`;
  }

  return desc; // unknown pattern — show as-is
};

const ActivityTab = ({ projectId, t }) => {
  const ACTION_TYPE_CONFIG = {
    progress:      { icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-100',  label: t('progress') || 'Progress' },
    estimate:      { icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-100', label: t('estimate') || 'Estimate' },
    act:           { icon: FileText,   color: 'text-blue-600',   bg: 'bg-blue-100',   label: t('act') || 'Act' },
    material:      { icon: Package,    color: 'text-orange-600', bg: 'bg-orange-100', label: t('material') || 'Material' },
    photo:         { icon: Camera,     color: 'text-pink-600',   bg: 'bg-pink-100',   label: t('photo') || 'Photo' },
    team:          { icon: Users,      color: 'text-cyan-600',   bg: 'bg-cyan-100',   label: t('team') || 'Team' },
    wbs:           { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'WBS' },
    stage:         { icon: Layers,     color: 'text-teal-600',   bg: 'bg-teal-100',   label: t('stages') || 'Stage' },
    expense:       { icon: Receipt,    color: 'text-rose-600',   bg: 'bg-rose-100',   label: t('expenses') || 'Expense' },
    project:       { icon: TrendingUp, color: 'text-blue-700',   bg: 'bg-blue-100',   label: t('project') || 'Project' },
    status_change: { icon: Clock,      color: 'text-amber-600',  bg: 'bg-amber-100',  label: t('status_change') || 'Status' },
  };
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const limit = 30;

  const loadActivities = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (filterType !== 'all') {
        params.action_type = filterType;
      }
      const result = await constructionService.listActivityLog(projectId, params);
      setActivities(result.data || []);
      setTotal(result.meta?.total || 0);
    } catch (error) {
      console.error('Failed to load activity log:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, filterType]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('just_now') || 'Hozir';
    if (diffMins < 60) return `${diffMins} ${t('minutes_ago') || 'daqiqa oldin'}`;
    if (diffHours < 24) return `${diffHours} ${t('hours_ago') || 'soat oldin'}`;
    if (diffDays < 7) return `${diffDays} ${t('days_ago') || 'kun oldin'}`;
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">{t('activity_log') || 'Faoliyat jurnali'}</span>
          <Badge variant="outline" className="text-xs">{total} {t('records') || 'yozuv'}</Badge>
        </div>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder={t('all_types') || 'Barcha turlari'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all') || 'Hammasi'}</SelectItem>
            <SelectItem value="progress">{t('progress') || 'Progress'}</SelectItem>
            <SelectItem value="estimate">{t('estimate') || 'Smeta'}</SelectItem>
            <SelectItem value="act">{t('act') || 'Akt'}</SelectItem>
            <SelectItem value="material">{t('material') || 'Material'}</SelectItem>
            <SelectItem value="photo">{t('photo') || 'Foto'}</SelectItem>
            <SelectItem value="team">{t('team') || 'Jamoa'}</SelectItem>
            <SelectItem value="wbs">WBS</SelectItem>
            <SelectItem value="status_change">{t('status_change') || 'Holat o\'zgarishi'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('no_activity') || 'Faoliyat yozuvlari yo\'q'}</p>
          <p className="text-xs mt-1">{t('activity_hint') || 'Loyihadagi harakatlar avtomatik yozib boriladi'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((activity) => {
            const config = ACTION_TYPE_CONFIG[activity.action_type] || ACTION_TYPE_CONFIG.status_change;
            const IconComponent = config.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3 py-3 px-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{translateActivityDesc(activity.description, t)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{activity.user_name || t('system') || 'Tizim'}</span>
                    <span className="text-xs text-slate-300">|</span>
                    <span className="text-xs text-slate-400">{formatDate(activity.created_at)}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityTab;
