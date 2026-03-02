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
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

const ACTION_TYPE_CONFIG = {
  progress: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100', label: 'Progress' },
  estimate: { icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Smeta' },
  act: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Akt' },
  material: { icon: Package, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Material' },
  photo: { icon: Camera, color: 'text-pink-600', bg: 'bg-pink-100', label: 'Foto' },
  team: { icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-100', label: 'Jamoa' },
  wbs: { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'WBS' },
  status_change: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Holat' },
};

const ActivityTab = ({ projectId, t }) => {
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
                  <p className="text-sm text-slate-700">{activity.description}</p>
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
