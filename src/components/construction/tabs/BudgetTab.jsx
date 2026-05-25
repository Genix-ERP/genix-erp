import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { sortBuildings } from '@/utils/naturalSort';
import SvodReportModal from '@/components/construction/SvodReportModal';

const getRowColor = (pct) => {
  if (pct <= 0) return '';
  if (pct < 90) return 'bg-green-50';
  if (pct <= 100) return 'bg-yellow-50';
  return 'bg-red-50';
};

const getBadgeColor = (pct) => {
  if (pct <= 0) return 'text-slate-500';
  if (pct < 90) return 'text-green-700';
  if (pct <= 100) return 'text-yellow-700';
  return 'text-red-700 font-bold';
};

const BudgetTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Buildings tab (mirrors StagesTab / migration 333). One pill per building;
  // an extra "Hammasi" pill keeps the existing project-wide view available
  // since budget totals make sense at the project level too, unlike Stages.
  const [buildings, setBuildings] = useState([]);
  const [buildingFilter, setBuildingFilter] = useState('all');

  // Свод (consolidated estimate) export modal — opens the Uzbek 12-line
  // "Сводная сметная" layout with the project's per-building FAKT figures
  // and user-editable percentage rows (overhead / insurance / VAT / PQ-161).
  const [svodOpen, setSvodOpen] = useState(false);

  // Load buildings once per project for the tab row.
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    constructionService
      .listBuildings(project.id)
      // Natural-sort (block 1 / block 2 / block 10 order) — backend ORDER BY
      // defaults to sort_order → code, which doesn't respect numeric suffixes.
      .then((rows) => { if (!cancelled) setBuildings(sortBuildings(Array.isArray(rows) ? rows : [])); })
      .catch(() => { if (!cancelled) setBuildings([]); });
    return () => { cancelled = true; };
  }, [project?.id]);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      // The service helper drops the param when the filter is 'all', so the
      // backend keeps its original project-wide behaviour by default.
      const data = await constructionService.getStageBudgetReport(project.id, {
        buildingId: buildingFilter,
      });
      setReport(data);
    } catch (e) {
      setError(t('budget_load_error') || 'Error loading budget report');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, buildingFilter]);

  useEffect(() => { load(); }, [load]);

  // Reset pagination whenever the active building tab changes so the user
  // never lands on a blank page after filtering to a smaller block.
  useEffect(() => { setCurrentPage(1); }, [buildingFilter]);

  if (loading) return <div className="text-center py-8 text-slate-400">{t('loading')}</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!report) return null;

  const rows = report.rows || [];
  const totalPlanned = report.total_planned || 0;
  const totalActual = report.total_actual || 0;
  const totalVariance = report.total_variance || 0;
  const totalPct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  // Group rows by stage. We track two pieces per stage:
  //   • rows: the per-category breakdown shown as indented sub-rows.
  //     Filtered to entries with a real category_id so we don't render
  //     "↳ Uncategorized" rows for backfilled expenses that lack a
  //     cost_category_id.
  //   • actualTotal: the sum of every row's actual for the stage,
  //     INCLUDING category_id = 0 rows. Per-work expenses written by
  //     the YAKUNIY backfill (migration 376) and the runtime
  //     finaliseMaterialsForWork have no cost_category_id, so without
  //     this they'd be invisible in the stage row's Fakt column even
  //     though the top-card "Umumiy fakt xarajatlar" sums them.
  const byStage = {};
  rows.forEach(row => {
    if (!byStage[row.stage_id]) {
      byStage[row.stage_id] = {
        name: row.stage_name,
        planned: row.planned_budget,
        rows: [],
        actualTotal: 0,
      };
    }
    byStage[row.stage_id].actualTotal += Number(row.actual || 0);
    if (row.category_id > 0 && row.actual > 0) {
      byStage[row.stage_id].rows.push(row);
    }
  });

  return (
    <div className="space-y-4">
      {/* Building tab row — mirrors Bosqichlar tab (migration 333). Unlike
          Stages, we keep a "Hammasi" pill so the user can still see the
          project-wide totals (which is the default view). The Свод export
          button sits on the right of this row so it's always visible
          alongside the block filter, regardless of whether buildings exist. */}
      <div className="flex flex-wrap items-center gap-2">
        {buildings.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setBuildingFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                buildingFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              {t('all') || 'Hammasi'}
            </button>
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBuildingFilter(String(b.id))}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  String(buildingFilter) === String(b.id)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
                title={b.code || b.name}
              >
                {b.name || b.code || `#${b.id}`}
              </button>
            ))}
          </>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSvodOpen(true)}
          className="text-xs"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1" />
          {/* Inline language map — `t()` from useTranslation returns the
              key itself when missing, so the old `t('svod_report') || ''`
              fallback never fired and the button rendered the raw key.
              We keep this label localised here (3 strings) instead of
              extending the 24k-line translations.jsx file. */}
          {({ uz: 'Свод hisobot', ru: 'Сводный отчёт', en: 'Svod report' })[language] || 'Свод hisobot'}
        </Button>
      </div>

      {/* Summary KPIs.
          The 4th "Byudjetdan foydalanish" (% utilization) card was
          removed per product feedback — the same percentage was
          already implied by the difference card (Og'ish), and a
          progress bar at 0–1% on a barely-started project read more
          like a chart artefact than useful information. Three cards
          here, four-column grid kept to match the surrounding spacing
          on the page. */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('budget_total_planned') || 'Total planned budget'}</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalPlanned)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('budget_total_actual') || 'Total actual expenses'}</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(totalActual)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('budget_variance') || 'Variance (planned - actual)'}</p>
          <p className={`text-xl font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
          </p>
        </CardContent></Card>
      </div>

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('budget_stage_category_title') || 'Plan vs Actual — Stage × Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(byStage).length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {t('budget_no_data') || 'No budget data found. Add stages and expenses first.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('budget_col_stage_category') || 'Stage / Category'}</th>
                    <th className="text-right py-2 px-3">{t('budget_col_planned') || 'Planned'}</th>
                    <th className="text-right py-2 px-3">{t('budget_col_actual') || 'Actual'}</th>
                    <th className="text-right py-2 px-3">{t('budget_col_variance') || 'Variance'}</th>
                    <th className="text-right py-2 px-3">%</th>
                    <th className="py-2 px-3">{t('budget_col_indicator') || 'Indicator'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const stageEntries = Object.entries(byStage);
                    const totalCount = stageEntries.length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const startIdx = (currentPage - 1) * pageSize;
                    const endIdx = startIdx + pageSize;
                    const paginatedEntries = stageEntries.slice(startIdx, endIdx);

                    return paginatedEntries.map(([stageId, stage]) => {
                    // Use the all-rows total (incl. uncategorized expenses)
                    // not just the categorised rows below — see byStage
                    // construction above for why.
                    const stageActual = stage.actualTotal || stage.rows.reduce((s, r) => s + r.actual, 0);
                    const stagePct = stage.planned > 0 ? (stageActual / stage.planned) * 100 : 0;
                    const stageVariance = stage.planned - stageActual;
                    return (
                      <React.Fragment key={stageId}>
                        <tr className={`${getRowColor(stagePct)} font-semibold border-t-2 border-slate-300`}>
                          <td className="py-2 px-3">{stage.name}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(stage.planned)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(stageActual)}</td>
                          <td className={`py-2 px-3 text-right ${stageVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stageVariance >= 0 ? '+' : ''}{formatCurrency(stageVariance)}
                          </td>
                          <td className={`py-2 px-3 text-right ${getBadgeColor(stagePct)}`}>{stagePct.toFixed(1)}%</td>
                          <td className="py-2 px-3">
                            <div className="w-24 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${stagePct < 90 ? 'bg-green-500' : stagePct <= 100 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, stagePct)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                        {stage.rows.map((row, i) => (
                          <tr key={i} className="border-b text-slate-600">
                            <td className="py-1 px-3 pl-8 text-slate-500">↳ {row.category_name}</td>
                            <td className="py-1 px-3 text-right">—</td>
                            <td className="py-1 px-3 text-right">{formatCurrency(row.actual)}</td>
                            <td className="py-1 px-3 text-right">—</td>
                            <td className="py-1 px-3 text-right">
                              <span className={getBadgeColor(row.variance_pct)}>{row.variance_pct.toFixed(1)}%</span>
                            </td>
                            <td className="py-1 px-3" />
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  });
                  })()}
                  <tr className="border-t-2 border-slate-400 font-bold bg-slate-100">
                    <td className="py-2 px-3">{t('total') || 'TOTAL'}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(totalPlanned)}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(totalActual)}</td>
                    <td className={`py-2 px-3 text-right ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
                    </td>
                    <td className={`py-2 px-3 text-right ${getBadgeColor(totalPct)}`}>{totalPct.toFixed(1)}%</td>
                    <td className="py-2 px-3" />
                  </tr>
                </tbody>
              </table>
              {(() => {
                const stageEntries = Object.entries(byStage);
                const totalCount = stageEntries.length;
                const totalPages = Math.ceil(totalCount / pageSize);
                return (
                  totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-slate-500">
                        {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} / {totalCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                      </div>
                    </div>
                  )
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> &lt;90% — {t('budget_legend_normal') || 'Normal'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 inline-block" /> 90–100% — {t('budget_legend_attention') || 'Attention'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> &gt;100% — {t('budget_legend_over') || 'Over budget'}</span>
      </div>

      {/* Свод (consolidated estimate) export modal. Mounted unconditionally;
          its `open` prop controls visibility so the data fetch only fires
          on actual open. */}
      <SvodReportModal
        open={svodOpen}
        onClose={() => setSvodOpen(false)}
        projectId={project?.id}
        projectName={project?.name}
      />
    </div>
  );
};

export default BudgetTab;
