import React, { useState, useEffect, useCallback, useRef } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight, Search, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Minus } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  overrun: { color: 'bg-red-100 text-red-700', icon: TrendingUp, label: 'svf_overrun' },
  warn: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, label: 'svf_warning' },
  ok: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'svf_ok' },
  completed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'svf_completed' },
  not_started: { color: 'bg-slate-100 text-slate-700', icon: Minus, label: 'svf_not_started' },
};

const SmetaVsFactTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});

  // Filters
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (stageFilter) params.stage_id = stageFilter;
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await constructionService.getSmetaVsFact(project.id, params);
      setData(res);
      // Auto-expand all sections
      if (res?.sections) {
        const expanded = {};
        res.sections.forEach((s, i) => { expanded[i] = true; });
        setExpandedSections(expanded);
      }
    } catch {
      toast.error(t('error_occurred') || 'Error loading data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, stageFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!project?.id) return;
    constructionService.listStages(project.id)
      .then(d => setStages(d || []))
      .catch(() => setStages([]));
  }, [project?.id]);

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getProgressColor = (pct) => {
    if (pct > 100) return 'bg-red-500';
    if (pct > 85) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleExportExcel = () => {
    if (!data) return;
    try {
      // Build CSV for simple export
      let csv = '\uFEFF'; // BOM for Excel UTF-8
      csv += `${t('svf_name') || 'Nomi'},${t('svf_unit') || 'Birlik'},${t('svf_qty_smeta') || 'Smeta miqdor'},${t('svf_qty_fact') || 'Fakt miqdor'},${t('svf_unit_price') || 'Birlik narx'},${t('svf_smeta_sum') || 'Smeta summa'},${t('svf_fact_sum') || 'Fakt summa'},${t('svf_completion') || 'Bajarilish %'},${t('svf_delta') || 'Farq'},${t('status') || 'Holat'}\n`;

      (data.sections || []).forEach(section => {
        csv += `\n"${section.section_name}",,,,,,,,\n`;
        (section.items || []).forEach(item => {
          csv += `"${item.name}","${item.unit}",${item.qty_smeta},${item.qty_fact},${item.unit_price},${item.smeta_sum},${item.fact_sum},${(item.completion_pct || 0).toFixed(1)},${item.delta},"${item.status}"\n`;
        });
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smeta_vs_fact_${project.name || project.id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('svf_exported') || 'Exported');
    } catch {
      toast.error(t('error_occurred') || 'Export failed');
    }
  };

  const summary = data?.summary || {};
  const sections = data?.sections || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_total_smeta') || 'Smeta jami'}</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.total_smeta || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_total_fact') || 'Fakt jami'}</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(summary.total_fact || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_completion') || 'Bajarilish'}</p>
            <p className="text-lg font-bold">{(summary.completion_pct || 0).toFixed(1)}%</p>
            <Progress value={Math.min(summary.completion_pct || 0, 100)} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_delta') || 'Farq'}</p>
            <p className={`text-lg font-bold ${(summary.delta || 0) > 0 ? 'text-red-600' : (summary.delta || 0) < 0 ? 'text-green-600' : ''}`}>
              {(summary.delta || 0) > 0 ? '+' : ''}{formatCurrency(summary.delta || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_overrun_count') || 'Oshib ketgan'}</p>
            <p className="text-lg font-bold text-red-600">{summary.overrun_count || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">{t('svf_not_started_count') || 'Boshlanmagan'}</p>
            <p className="text-lg font-bold text-slate-500">{summary.not_started_count || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('svf_search_placeholder') || 'Ish nomi bo\'yicha qidirish...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={stageFilter || 'all'} onValueChange={v => setStageFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('svf_all_stages') || 'Barcha bosqichlar'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('svf_all_stages') || 'Barcha bosqichlar'}</SelectItem>
            {stages.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('svf_all_statuses') || 'Barcha holatlar'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('svf_all_statuses') || 'Barcha holatlar'}</SelectItem>
            <SelectItem value="over">{t('svf_overrun') || 'Oshib ketgan'}</SelectItem>
            <SelectItem value="warn">{t('svf_warning') || 'Ogohlantirish'}</SelectItem>
            <SelectItem value="ok">{t('svf_ok') || 'Normal'}</SelectItem>
            <SelectItem value="zero">{t('svf_not_started') || 'Boshlanmagan'}</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <Download className="w-4 h-4 mr-1" />
          Excel
        </Button>
      </div>

      {/* Data Table */}
      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('svf_no_data') || 'Ma\'lumot topilmadi. Smeta va tasdiqlangan aktlar kerak.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section, sIdx) => (
            <Card key={sIdx}>
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(sIdx)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expandedSections[sIdx] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <CardTitle className="text-sm font-semibold">{section.section_name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{(section.items || []).length}</Badge>
                  </div>
                </div>
              </CardHeader>

              {expandedSections[sIdx] && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium">№</th>
                          <th className="text-left px-4 py-2 font-medium">{t('svf_name') || 'Nomi'}</th>
                          <th className="text-center px-3 py-2 font-medium">{t('svf_unit') || 'Birlik'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_qty_smeta') || 'Smeta'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_qty_fact') || 'Fakt'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_unit_price') || 'Narx'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_smeta_sum') || 'Smeta summa'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_fact_sum') || 'Fakt summa'}</th>
                          <th className="text-center px-3 py-2 font-medium" style={{ minWidth: 140 }}>{t('svf_completion') || 'Bajarilish'}</th>
                          <th className="text-right px-3 py-2 font-medium">{t('svf_delta') || 'Farq'}</th>
                          <th className="text-center px-3 py-2 font-medium">{t('status') || 'Holat'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(section.items || []).map((item, iIdx) => {
                          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ok;
                          const pct = item.completion_pct || 0;
                          return (
                            <tr key={item.smeta_item_id || iIdx} className="border-t hover:bg-muted/20">
                              <td className="px-4 py-2 text-muted-foreground">{iIdx + 1}</td>
                              <td className="px-4 py-2 max-w-[250px]">
                                <span className="line-clamp-2">{item.name}</span>
                              </td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{item.unit}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{Number(item.qty_smeta || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{Number(item.qty_fact || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.unit_price || 0)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.smeta_sum || 0)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.fact_sum || 0)}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${getProgressColor(pct)}`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium min-w-[40px] text-right ${pct > 100 ? 'text-red-600' : pct > 85 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {pct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums ${(item.delta || 0) > 0 ? 'text-red-600' : (item.delta || 0) < 0 ? 'text-green-600' : ''}`}>
                                {(item.delta || 0) > 0 ? '+' : ''}{formatCurrency(item.delta || 0)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge className={`text-[10px] ${cfg.color}`}>
                                  {t(cfg.label) || item.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmetaVsFactTab;
