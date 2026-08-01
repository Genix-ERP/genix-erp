import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  History, RotateCcw, ExternalLink, CheckCircle2, XCircle, MinusCircle, SkipForward, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import workflowsService from '@/api/services/workflows';
import { EVENT_BY_VALUE, relatedRecordLink, ACTION_TYPES } from './ruleCatalog';

const STATUS_META = {
  success: { icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', labelKey: 'wf_status_success' },
  failed: { icon: XCircle, badge: 'bg-red-50 text-red-700 border-red-200', labelKey: 'wf_status_failed' },
  partial: { icon: MinusCircle, badge: 'bg-amber-50 text-amber-700 border-amber-200', labelKey: 'wf_status_partial' },
  skipped_conditions: { icon: SkipForward, badge: 'bg-slate-50 text-slate-500 border-slate-200', labelKey: 'wf_status_skipped' },
};

function StatusBadge({ status, t }) {
  const meta = STATUS_META[status] || STATUS_META.partial;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${meta.badge}`}>
      <Icon className="w-3 h-3" />
      {t(meta.labelKey)}
    </Badge>
  );
}

function parseMaybeJSON(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

export default function ExecutionLog({ rules, t }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ rule_id: 'all', status: 'all', date_from: '', date_to: '' });
  const [selectedLog, setSelectedLog] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filters.rule_id !== 'all') params.rule_id = filters.rule_id;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const data = await workflowsService.listLogs(params);
      setLogs(data || []);
    } catch {
      toast.error(t('loading_error'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleRetry = async (log) => {
    setRetrying(true);
    try {
      await workflowsService.retryLog(log.id);
      toast.success(t('wf_retry_started'));
      setSelectedLog(null);
      fetchLogs();
    } catch {
      toast.error(t('wf_retry_failed'));
    } finally {
      setRetrying(false);
    }
  };

  const hasActiveFilters = filters.rule_id !== 'all' || filters.status !== 'all' || filters.date_from || filters.date_to;

  const detail = useMemo(() => {
    if (!selectedLog) return null;
    return {
      triggerData: parseMaybeJSON(selectedLog.trigger_data) || {},
      actions: parseMaybeJSON(selectedLog.actions_executed) || [],
      conditions: parseMaybeJSON(selectedLog.condition_results) || [],
    };
  }, [selectedLog]);

  const actionLabel = (type) => {
    const def = ACTION_TYPES.find((a) => a.value === type);
    return def ? t(def.labelKey) : type;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.rule_id} onValueChange={(v) => setFilters((f) => ({ ...f, rule_id: v }))}>
          <SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('wf_all_rules')}</SelectItem>
            {(rules || []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('wf_all_statuses')}</SelectItem>
            <SelectItem value="success">{t('wf_status_success')}</SelectItem>
            <SelectItem value="partial">{t('wf_status_partial')}</SelectItem>
            <SelectItem value="failed">{t('wf_status_failed')}</SelectItem>
            <SelectItem value="skipped_conditions">{t('wf_status_skipped')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-40 bg-white"
          value={filters.date_from}
          onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
        />
        <span className="text-slate-400 text-sm">—</span>
        <Input
          type="date"
          className="w-40 bg-white"
          value={filters.date_to}
          onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
        />
        {hasActiveFilters && (
          <Button
            variant="ghost" size="sm" className="text-slate-500 gap-1"
            onClick={() => setFilters({ rule_id: 'all', status: 'all', date_from: '', date_to: '' })}
          >
            <X className="w-3.5 h-3.5" /> {t('clear_filters')}
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <History className="w-14 h-14 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">{t('no_logs_yet')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('no_logs_desc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const event = log.trigger_event ? EVENT_BY_VALUE[log.trigger_event] : null;
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedLog(log)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all flex items-center gap-4"
              >
                <div className="w-32 shrink-0">
                  <div className="text-sm text-slate-700 font-medium">
                    {format(new Date(log.executed_at), 'dd.MM.yyyy')}
                  </div>
                  <div className="text-xs text-slate-400">{format(new Date(log.executed_at), 'HH:mm:ss')}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{log.rule_name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {event ? t(event.labelKey) : log.trigger_event}
                  </div>
                </div>
                <div className="hidden sm:block w-20 text-right text-xs text-slate-400 shrink-0">
                  {log.duration_ms != null ? `${log.duration_ms} ms` : ''}
                </div>
                <StatusBadge status={log.status} t={t} />
              </button>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLog && detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  <History className="w-5 h-5 text-[var(--genix-blue)]" />
                  <span className="truncate">{selectedLog.rule_name}</span>
                  <StatusBadge status={selectedLog.status} t={t} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-slate-400">{t('wf_executed_at')}</div>
                    <div className="text-slate-700">{format(new Date(selectedLog.executed_at), 'dd.MM.yyyy HH:mm:ss')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('wf_duration')}</div>
                    <div className="text-slate-700">{selectedLog.duration_ms != null ? `${selectedLog.duration_ms} ms` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('trigger_event')}</div>
                    <div className="text-slate-700">
                      {selectedLog.trigger_event && EVENT_BY_VALUE[selectedLog.trigger_event]
                        ? t(EVENT_BY_VALUE[selectedLog.trigger_event].labelKey)
                        : selectedLog.trigger_event || '—'}
                    </div>
                  </div>
                </div>

                {/* Related record link */}
                {selectedLog.related_type && selectedLog.related_id && (() => {
                  const link = relatedRecordLink(selectedLog.related_type, selectedLog.related_id, detail.triggerData);
                  return link ? (
                    <Link
                      to={link}
                      className="inline-flex items-center gap-1.5 text-[var(--genix-blue)] hover:underline text-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('wf_open_record')} ({t(`wf_rt_${selectedLog.related_type}`)})
                    </Link>
                  ) : null;
                })()}

                {selectedLog.error_message && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-xs font-mono whitespace-pre-wrap">
                    {selectedLog.error_message}
                  </div>
                )}

                {/* Condition results */}
                {detail.conditions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('wf_if_title')}</div>
                    <div className="space-y-1">
                      {detail.conditions.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-slate-50 px-3 py-2">
                          {c.passed
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          <span className="font-mono text-slate-700">
                            {c.field} {c.operator} {JSON.stringify(c.expected)}
                          </span>
                          <span className="text-slate-400 ml-auto">
                            {t('wf_actual')}: {JSON.stringify(c.actual)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action results */}
                {detail.actions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('wf_then_title')}</div>
                    <div className="space-y-1">
                      {detail.actions.map((a, i) => (
                        <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            {a.error
                              ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            <span className="font-medium text-slate-700">{actionLabel(a.type)}</span>
                            {a.duration_ms != null && <span className="text-slate-400 ml-auto">{a.duration_ms} ms</span>}
                          </div>
                          {a.result && <div className="text-slate-500 pl-5.5 ml-5">{a.result}</div>}
                          {a.error && <div className="text-red-600 font-mono ml-5">{a.error}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payload snapshot */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('wf_payload')}</div>
                  <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] overflow-x-auto">
                    {JSON.stringify(detail.triggerData, null, 2)}
                  </pre>
                </div>

                {/* Retry for failed/partial */}
                {(selectedLog.status === 'failed' || selectedLog.status === 'partial') && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleRetry(selectedLog)}
                      disabled={retrying}
                      variant="outline"
                      className="gap-1.5"
                    >
                      <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                      {t('wf_retry_run')}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
