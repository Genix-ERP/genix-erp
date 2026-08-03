import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import apiClient from '@/api/client';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { formatAxisTick } from '@/utils/formatCurrency';
import {
  Loader2, ChevronDown, Check, Search, X, Clock,
  TrendingUp, Wallet, ArrowDownRight, ArrowUpRight,
  FileText, Target, Package, HardHat, Users, Building2,
  BarChart3, PieChart as PieChartIcon, Table2, ShoppingCart, ShoppingBag,
  MonitorCog,
} from 'lucide-react';

// Per-company series palette. The ORDER is the colorblind-safety mechanism:
// blue → orange → green → violet → amber passes adjacent-pair CVD ΔE ≥ 8
// (validated); re-ordering it can put amber next to orange, which are
// indistinguishable under deuteranopia.
const PAL = [
  { c: '#185FA5', l: '#E6F1FB', d: '#0C447C' },
  { c: '#D85A30', l: '#FAECE7', d: '#712B13' },
  { c: '#1D9E75', l: '#E1F5EE', d: '#085041' },
  { c: '#534AB7', l: '#EEEDFE', d: '#3C3489' },
  { c: '#BA7517', l: '#FAEEDA', d: '#633806' },
];

const PERIOD_OPTIONS = [
  { id: 'day', uz: 'Kun', ru: 'День', en: 'Day' },
  { id: 'month', uz: 'Oy', ru: 'Месяц', en: 'Month' },
  { id: 'quarter', uz: 'Chorak', ru: 'Квартал', en: 'Quarter' },
  { id: 'year', uz: 'Yil', ru: 'Год', en: 'Year' },
];

const SECTION_OPTIONS = [
  { id: 'all', uz: 'Hammasi', ru: 'Все', en: 'All' },
  { id: 'finance', uz: 'Moliya', ru: 'Финансы', en: 'Finance' },
  { id: 'inventory', uz: 'Sklad', ru: 'Склад', en: 'Stock' },
  { id: 'construction', uz: 'Qurilish', ru: 'Строительство', en: 'Construction' },
  { id: 'hr', uz: 'Kadrlar', ru: 'Кадры', en: 'HR' },
];

const PROJECT_STATUS_COLOR = {
  in_progress: { bg: '#E1F5EE', fg: '#0F6E56' },
  active: { bg: '#E1F5EE', fg: '#0F6E56' },
  delayed: { bg: '#FAEEDA', fg: '#8A5A12' },
  draft: { bg: '#E6F1FB', fg: '#0C447C' },
  planning: { bg: '#E6F1FB', fg: '#0C447C' },
  completed: { bg: '#EEE', fg: '#555' },
};

// (uz, ru, en) tuples for status badges. The local t() helper takes
// the triple positionally — same shape as the rest of this page —
// so consumers call t(...STATUS_LABEL[p.status]) when rendering.
const STATUS_LABEL = {
  draft: ['Qoralama', 'Черновик', 'Draft'],
  in_progress: ['Jarayonda', 'В процессе', 'In Progress'],
  active: ['Faol', 'Активный', 'Active'],
  planning: ['Rejalashtirish', 'Планирование', 'Planning'],
  completed: ['Tugallangan', 'Завершён', 'Completed'],
  delayed: ['Kechikkan', 'С задержкой', 'Delayed'],
  on_hold: ['Toʻxtatilgan', 'Приостановлено', 'On Hold'],
  cancelled: ['Bekor qilingan', 'Отменён', 'Cancelled'],
};

// toLocaleString('uz-UZ') renders short months as "M08" in most engines,
// so month names are spelled out per language instead.
const MONTHS = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const initials = (name) => (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtCompact = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
};
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const truncate = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n - 1) + '…' : s);

// Get range of months back from now (returns [{label, year, month, key}])
const monthRange = (count) => {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return months;
};

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl px-3 py-2 min-w-[140px]">
      {label != null && label !== '' && (
        <p className="text-[11px] font-medium text-slate-400 mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-500 truncate">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-900 tabular-nums">{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, chip, valueCls, spark }) {
  return (
    <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-1 truncate ${valueCls || 'text-slate-900'}`}>{value}</p>
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${chip}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {spark && <div className="h-10 mt-3 -mx-2 -mb-2">{spark}</div>}
    </div>
  );
}

function SectionCard({ icon: Icon, title, chip, cells, colsCls }) {
  return (
    <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${chip}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className={`grid grid-cols-2 gap-2.5 ${colsCls || 'md:grid-cols-4'}`}>
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50/70 px-4 py-3 min-w-0">
            <p className="text-xs text-slate-500 truncate">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 truncate ${c.cls || 'text-slate-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function EmptyNote({ icon: Icon, text }) {
  return (
    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 max-w-[280px]">{text}</p>
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      )}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              value === o.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DirectorDashboard() {
  const { language } = useLanguage();
  const { companies, isLoading: companiesLoading } = useCompany();

  const [selectedIds, setSelectedIds] = useState(new Set()); // empty = all
  const [period, setPeriod] = useState('month');
  const [section, setSection] = useState('all');
  const [currency, setCurrency] = useState('UZS');
  const [clock, setClock] = useState(new Date());
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  const [perCompany, setPerCompany] = useState({}); // { [orgId]: { revenue, expenses, profit, deb, cred, monthlyRev[], expenseBreakdown{} } }
  const [loading, setLoading] = useState(false);

  const allMode = selectedIds.size === 0;
  const visibleCompanies = useMemo(() => {
    if (!companies) return [];
    return allMode ? companies : companies.filter(c => selectedIds.has(c.id));
  }, [companies, selectedIds, allMode]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch all companies' metrics in a single backend call.
  // The /reports/director-summary endpoint aggregates per-org revenue, expenses,
  // debtors/creditors, inventory, and HR stats in one round-trip.
  const [monthLabels, setMonthLabels] = useState([]);
  // Top-level (tenant-wide) sales block: period-scoped orders + current
  // overdue receivables. Absent on old cached responses — guard on null.
  const [salesSummary, setSalesSummary] = useState(null);
  const [assetsSummary, setAssetsSummary] = useState(null);

  const loadAll = useCallback(async () => {
    if (!companies || companies.length === 0) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/reports/director-summary', {
        params: { period },
      });
      const payload = res.data?.data ?? res.data ?? {};
      const rows = Array.isArray(payload.companies) ? payload.companies : [];
      if (Array.isArray(payload.month_labels)) setMonthLabels(payload.month_labels);
      setSalesSummary(payload.sales && typeof payload.sales === 'object' ? payload.sales : null);
      setAssetsSummary(payload.assets && typeof payload.assets === 'object' ? payload.assets : null);
      const next = {};
      rows.forEach(row => {
        next[row.id] = {
          revenue: Number(row.revenue || 0),
          expenses: Number(row.expenses || 0),
          profit: Number(row.profit || 0),
          deb: Number(row.debtors || 0),
          cred: Number(row.creditors || 0),
          monthlyRev: Array.isArray(row.monthly_revenue) ? row.monthly_revenue : [],
          expenseBreakdown: row.expense_by_category || {},
          stockUnits: Number(row.stock_units || 0),
          stockValue: Number(row.stock_value || 0),
          lowStockCount: Number(row.low_stock_count || 0),
          topProducts: Array.isArray(row.top_stock_products) ? row.top_stock_products : [],
          productCount: Array.isArray(row.top_stock_products) ? row.top_stock_products.length : 0,
          activeEmployees: Number(row.active_employees || 0),
          totalEmployees: Number(row.total_employees || 0),
          salaryFund: Number(row.salary_fund || 0),
          payrollFund: Number(row.payroll_fund || 0),
          payrollUnpaid: Number(row.payroll_unpaid || 0),
          constructionProjects: Array.isArray(row.construction_projects) ? row.construction_projects : [],
          activeContracts: Number(row.active_contracts || 0),
          activeContractsValue: Number(row.active_contracts_value || 0),
          expiringContracts: Number(row.expiring_contracts || 0),
          contractsOutstanding: Number(row.contracts_outstanding || 0),
          purchasesPeriodTotal: Number(row.purchases_period_total || 0),
          purchasesPeriodCount: Number(row.purchases_period_count || 0),
          purchaseAPTotal: Number(row.purchase_ap_total || 0),
          purchaseOverdueDeliveries: Number(row.purchase_overdue_deliveries || 0),
          crmOpenLeads: Number(row.crm_open_leads || 0),
          crmPipelineValue: Number(row.crm_pipeline_value || 0),
          crmWonMonth: Number(row.crm_won_month || 0),
          crmWonValueMonth: Number(row.crm_won_value_month || 0),
          crmConversion: Number(row.crm_conversion || 0),
          crmTopLossReason: row.crm_top_loss_reason || '',
        };
      });
      setPerCompany(next);
    } catch (e) {
      console.warn('[DirectorDashboard] /reports/director-summary failed', e?.response?.status, e?.response?.data);
      setPerCompany({});
      setSalesSummary(null);
      setAssetsSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companies, period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Chart x-axis labels come from the backend — they follow whatever
  // period is currently active (days, months, quarters or years).
  // Fall back to the client-side month range only if the server
  // hasn't responded yet.
  const months = useMemo(() => {
    if (monthLabels.length > 0) return monthLabels.map(l => ({ label: l }));
    return monthRange(6);
  }, [monthLabels]);

  // Aggregates
  const agg = useMemo(() => {
    const data = visibleCompanies.map(c => perCompany[c.id]).filter(Boolean);
    return {
      revenue: sum(data.map(d => d.revenue)),
      profit: sum(data.map(d => d.profit)),
      deb: sum(data.map(d => d.deb)),
      cred: sum(data.map(d => d.cred)),
    };
  }, [visibleCompanies, perCompany]);

  const aggOf = useCallback(
    (pick) => sum(visibleCompanies.map(c => pick(perCompany[c.id] || {}))),
    [visibleCompanies, perCompany],
  );

  // Revenue line chart data (per company per month)
  const revenueChartData = useMemo(() => {
    return months.map((m, idx) => {
      const row = { month: m.label };
      visibleCompanies.forEach(co => {
        const d = perCompany[co.id];
        if (d) row[co.company_name || co.id] = d.monthlyRev[idx] || 0;
      });
      return row;
    });
  }, [months, visibleCompanies, perCompany]);

  // Sparkline for the revenue tile: totals across visible companies
  const revenueSpark = useMemo(() => {
    return months.map((m, idx) => ({
      x: m.label,
      v: sum(visibleCompanies.map(co => (perCompany[co.id]?.monthlyRev || [])[idx] || 0)),
    }));
  }, [months, visibleCompanies, perCompany]);
  const hasSpark = revenueSpark.some(p => p.v > 0);

  // Expense breakdown across visible companies → top 6 + "Other".
  // Nominal categories, one measure — rendered as a single-hue bar list.
  const expenseRows = useMemo(() => {
    const merged = {};
    visibleCompanies.forEach(co => {
      const d = perCompany[co.id];
      if (!d) return;
      Object.entries(d.expenseBreakdown).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + Number(v || 0);
      });
    });
    const rows = Object.entries(merged)
      .map(([name, value]) => ({ name, value }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 6);
    const rest = rows.slice(6);
    const restSum = sum(rest.map(r => r.value));
    return restSum > 0 ? [...top, { name: null, value: restSum, other: rest.length }] : top;
  }, [visibleCompanies, perCompany]);
  const expenseTotal = sum(expenseRows.map(r => r.value));

  // Toggle a company pill
  const toggleCompany = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.size === 0) {
        // From "all" → select only this one
        return new Set([id]);
      }
      if (next.has(id)) {
        if (next.size === 1) return next; // can't deselect last
        next.delete(id);
      } else {
        next.add(id);
      }
      // If all selected → switch to "all" mode
      if (next.size === companies.length) return new Set();
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set());

  const t = (uz, ru, en) => language === 'uz' ? uz : language === 'ru' ? ru : en;
  const show = (key) => section === 'all' || section === key;
  const paletteFor = (co) => PAL[Math.max(0, (companies || []).findIndex(c => c.id === co.id)) % PAL.length];

  const two = (n) => String(n).padStart(2, '0');
  const monthNames = MONTHS[language] || MONTHS.en;
  const clockText = `${clock.getDate()} ${monthNames[clock.getMonth()]}, ${two(clock.getHours())}:${two(clock.getMinutes())}:${two(clock.getSeconds())}`;

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const singleCompany = visibleCompanies.length === 1;

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Toolbar: company scope + filters + clock */}
      <div className="glass-card bg-white/80 border border-slate-200/60 rounded-2xl shadow-sm px-4 py-3 mb-4 relative">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setCompanyPickerOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors min-w-[220px] max-w-[380px]"
          >
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-900 truncate flex-1 text-left">
              {allMode
                ? t('Barcha kompaniyalar', 'Все компании', 'All companies') + ` (${(companies || []).length})`
                : singleCompany
                  ? visibleCompanies[0].company_name
                  : t(`${visibleCompanies.length} ta kompaniya`, `${visibleCompanies.length} компаний`, `${visibleCompanies.length} companies`)
              }
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${companyPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Selected chips (first few, for quick deselect) */}
          {!allMode && visibleCompanies.slice(0, 3).map((co) => {
            const pa = paletteFor(co);
            return (
              <div
                key={co.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                style={{ backgroundColor: pa.l, color: pa.d }}
              >
                <span className="font-medium">{co.company_name}</span>
                <button onClick={() => toggleCompany(co.id)} className="hover:bg-black/10 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {!allMode && visibleCompanies.length > 3 && (
            <span className="text-xs text-slate-500 font-medium">+{visibleCompanies.length - 3}</span>
          )}

          <div className="ml-auto flex items-center gap-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              {clockText}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 pt-3 border-t border-slate-100">
          <Segmented
            label={t('Davr', 'Период', 'Period')}
            options={PERIOD_OPTIONS.map(o => ({ id: o.id, label: o[language] || o.en }))}
            value={period}
            onChange={setPeriod}
          />
          <Segmented
            label={t('Valyuta', 'Валюта', 'Currency')}
            options={[
              { id: 'UZS', label: t('Som', 'Сум', 'Sum') },
              { id: 'USD', label: 'USD' },
            ]}
            value={currency}
            onChange={setCurrency}
          />
          <Segmented
            label={t("Bo'lim", 'Раздел', 'Section')}
            options={SECTION_OPTIONS.map(o => ({ id: o.id, label: o[language] || o.en }))}
            value={section}
            onChange={setSection}
          />
        </div>

        {/* Company dropdown panel */}
        {companyPickerOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setCompanyPickerOpen(false)} />
            <div className="absolute top-full left-4 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-40 w-[380px] max-h-[420px] flex flex-col overflow-hidden">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 ml-1" />
                <input
                  type="text"
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder={t('Qidirish...', 'Поиск...', 'Search...')}
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <button
                  onClick={selectAll}
                  className="text-xs font-medium text-[#185FA5] hover:underline px-2"
                >
                  {allMode
                    ? t('Tanlovni tozalash', 'Очистить выбор', 'Clear selection')
                    : t('Barchasini tanlash', 'Выбрать все', 'Select all')
                  }
                </button>
                <span className="text-[11px] text-slate-400 px-2">
                  {allMode ? (companies || []).length : selectedIds.size} / {(companies || []).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {(companies || [])
                  .filter(co => !companySearch || (co.company_name || '').toLowerCase().includes(companySearch.toLowerCase()))
                  .map((co) => {
                    const pa = paletteFor(co);
                    const checked = allMode || selectedIds.has(co.id);
                    return (
                      <button
                        key={co.id}
                        onClick={() => toggleCompany(co.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-[#185FA5] border-[#185FA5]' : 'border-slate-300'}`}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pa.l, color: pa.d }}>
                          {initials(co.company_name)}
                        </div>
                        <span className="text-xs font-medium text-slate-900 truncate">{co.company_name}</span>
                      </button>
                    );
                  })
                }
              </div>
            </div>
          </>
        )}
      </div>

      {/* Refetch keeps the previous render visible at reduced opacity — no skeleton flash */}
      <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}>

        {/* Hero KPI row — the headline finance numbers */}
        {show('finance') && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile
              label={t('Tushum', 'Выручка', 'Revenue')}
              value={fmtCompact(agg.revenue)}
              icon={TrendingUp}
              chip="bg-sky-50 text-sky-600"
              spark={hasSpark && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSpark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dirRevSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#185FA5" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#185FA5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="#185FA5" strokeWidth={1.5} fill="url(#dirRevSpark)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            />
            <StatTile
              label={t('Foyda', 'Прибыль', 'Profit')}
              value={fmtCompact(agg.profit)}
              icon={Wallet}
              chip={agg.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
              valueCls={agg.profit < 0 ? 'text-rose-600' : undefined}
            />
            <StatTile
              label={t('Debitorlar', 'Дебиторы', 'Debtors')}
              value={fmtCompact(agg.deb)}
              icon={ArrowDownRight}
              chip="bg-amber-50 text-amber-600"
            />
            <StatTile
              label={t('Kreditorlar', 'Кредиторы', 'Creditors')}
              value={fmtCompact(agg.cred)}
              icon={ArrowUpRight}
              chip="bg-violet-50 text-violet-600"
            />
          </div>
        )}

        {/* Finance charts */}
        {show('finance') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title={t('Tushum dinamikasi', 'Динамика выручки', 'Revenue trend')} icon={TrendingUp} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatAxisTick} />
                  <Tooltip content={<GlassTooltip />} />
                  {!singleCompany && (
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                  )}
                  {visibleCompanies.map((co) => (
                    <Line
                      key={co.id}
                      type="monotone"
                      dataKey={co.company_name || co.id}
                      stroke={paletteFor(co).c}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('Xarajatlar tarkibi', 'Структура расходов', 'Expense structure')} icon={PieChartIcon}>
              {expenseRows.length === 0 ? (
                <EmptyNote icon={PieChartIcon} text={t('Maʼlumot yo‘q', 'Нет данных', 'No data')} />
              ) : (
                <div className="space-y-3 pt-1">
                  {expenseRows.map((r, i) => {
                    const pct = expenseTotal > 0 ? (r.value / expenseTotal) * 100 : 0;
                    const name = r.name ?? `${t('Boshqalar', 'Другие', 'Other')} (${r.other})`;
                    return (
                      <div key={r.name ?? '__other'} title={name}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className={`truncate ${r.name ? 'text-slate-600' : 'text-slate-400'}`}>{name}</span>
                          <span className="shrink-0 tabular-nums">
                            <span className="font-semibold text-slate-900">{fmtCompact(r.value)}</span>
                            <span className="text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: r.name ? '#185FA5' : '#94a3b8' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </div>
        )}

        {/* Contracts */}
        {show('finance') && (
          <SectionCard
            icon={FileText}
            title={t('Shartnomalar', 'Договоры', 'Contracts')}
            chip="bg-sky-50 text-sky-600"
            cells={[
              { label: t('Amaldagi shartnomalar', 'Действующие', 'Active'), value: fmtCompact(aggOf(d => d.activeContracts || 0)) },
              { label: t('Shartnomalar summasi', 'Сумма договоров', 'Total value'), value: fmtCompact(aggOf(d => d.activeContractsValue || 0)) },
              {
                label: t('Muddati tugayotgan', 'Истекающие', 'Expiring soon'),
                value: fmtCompact(aggOf(d => d.expiringContracts || 0)),
                cls: aggOf(d => d.expiringContracts || 0) > 0 ? 'text-amber-600' : undefined,
              },
              {
                label: t("To'lanmagan qoldiq", 'Неоплаченный остаток', 'Outstanding'),
                value: fmtCompact(aggOf(d => d.contractsOutstanding || 0)),
                cls: aggOf(d => d.contractsOutstanding || 0) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* CRM */}
        {show('finance') && (
          <SectionCard
            icon={Target}
            title="CRM"
            chip="bg-violet-50 text-violet-600"
            cells={[
              { label: t('Ochiq lidlar', 'Открытые лиды', 'Open leads'), value: fmtCompact(aggOf(d => d.crmOpenLeads || 0)) },
              { label: t('Voronka summasi', 'Сумма воронки', 'Pipeline value'), value: fmtCompact(aggOf(d => d.crmPipelineValue || 0)) },
              { label: t('Bu oy yutilgan', 'Выиграно за месяц', 'Won this month'), value: fmtCompact(aggOf(d => d.crmWonValueMonth || 0)) },
              {
                label: t('Konversiya', 'Конверсия', 'Conversion'),
                value: (() => {
                  const vals = visibleCompanies.map(c => perCompany[c.id]?.crmConversion || 0).filter(v => v > 0);
                  return vals.length ? `${Math.round(sum(vals) / vals.length)}%` : '0%';
                })(),
              },
            ]}
          />
        )}

        {/* Savdo (sales) — tenant-wide block from the top-level `sales`
            field; period-scoped orders, current overdue receivables.
            Hidden entirely when the backend doesn't send it (old cache). */}
        {show('finance') && salesSummary && (
          <SectionCard
            icon={ShoppingBag}
            title={t('Savdo', 'Продажи', 'Sales')}
            chip="bg-emerald-50 text-emerald-600"
            cells={[
              { label: t('Buyurtmalar (davr)', 'Заказы (период)', 'Orders (period)'), value: fmtCompact(Number(salesSummary.orders_count) || 0) },
              { label: t('Buyurtmalar summasi', 'Сумма заказов', 'Orders total'), value: fmtCompact(Number(salesSummary.orders_sum) || 0) },
              {
                label: t("Muddati o'tgan fakturalar", 'Просроченные счета', 'Overdue invoices'),
                value: fmtCompact(Number(salesSummary.overdue_invoices) || 0),
                cls: (Number(salesSummary.overdue_invoices) || 0) > 0 ? 'text-rose-600' : undefined,
              },
              {
                label: t("Muddati o'tgan debitorka", 'Просроченная дебиторка', 'Overdue receivables'),
                value: fmtCompact(Number(salesSummary.overdue_receivables) || 0),
                cls: (Number(salesSummary.overdue_receivables) || 0) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* Aktivlar (fixed assets) — tenant-wide NBV, this-month depreciation,
            fleet status. Hidden when the backend doesn't send it (old cache). */}
        {show('finance') && assetsSummary && (assetsSummary.total_count || 0) > 0 && (
          <SectionCard
            icon={MonitorCog}
            title={t('Aktivlar', 'Активы', 'Assets')}
            chip="bg-amber-50 text-amber-600"
            cells={[
              { label: t('Asosiy vositalar', 'Основные средства', 'Fixed assets'), value: fmtCompact(Number(assetsSummary.total_count) || 0) },
              { label: t('Qoldiq qiymat', 'Остаточная стоимость', 'Net book value'), value: fmtCompact(Number(assetsSummary.total_book_value) || 0) },
              { label: t('Oylik amortizatsiya', 'Амортизация за месяц', 'Monthly depreciation'), value: fmtCompact(Number(assetsSummary.month_depreciation) || 0) },
              {
                label: t('Foydalanishda / Konserv.', 'В эксплуатации / Конс.', 'In service / Conserved'),
                value: `${Number(assetsSummary.in_service) || 0} / ${Number(assetsSummary.conserved) || 0}`,
              },
            ]}
          />
        )}

        {/* Xarid (purchasing) */}
        {show('inventory') && (
          <SectionCard
            icon={ShoppingCart}
            title={t('Xarid', 'Закупки', 'Purchasing')}
            chip="bg-sky-50 text-sky-600"
            cells={[
              { label: t('Davr xaridi', 'Закупки за период', 'Period purchases'), value: fmtCompact(aggOf(d => d.purchasesPeriodTotal || 0)) },
              { label: t('Buyurtmalar', 'Заказы', 'Orders'), value: fmtCompact(aggOf(d => d.purchasesPeriodCount || 0)) },
              {
                label: t('Taʼminotchilarga qarz', 'Долг поставщикам', 'Owed to suppliers'),
                value: fmtCompact(aggOf(d => d.purchaseAPTotal || 0)),
              },
              {
                label: t('Kechikkan yetkazmalar', 'Просроченные поставки', 'Overdue deliveries'),
                value: fmtCompact(aggOf(d => d.purchaseOverdueDeliveries || 0)),
                cls: aggOf(d => d.purchaseOverdueDeliveries || 0) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* Inventory */}
        {show('inventory') && (
          <SectionCard
            icon={Package}
            title={t('Sklad', 'Склад', 'Inventory')}
            chip="bg-emerald-50 text-emerald-600"
            cells={[
              { label: t('Mahsulotlar', 'Товары', 'Products'), value: fmtCompact(aggOf(d => d.productCount || 0)) },
              { label: t('Sklad qiymati', 'Стоимость склада', 'Stock value'), value: fmtCompact(aggOf(d => d.stockValue || 0)) },
              { label: t('Birliklar', 'Единицы', 'Units'), value: fmtCompact(aggOf(d => d.stockUnits || 0)) },
              {
                label: t('Kam qoldiq', 'Низкий остаток', 'Low stock'),
                value: fmtCompact(aggOf(d => d.lowStockCount || 0)),
                cls: aggOf(d => d.lowStockCount || 0) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* Inventory charts */}
        {show('inventory') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t('Sklad qoldiqlari (top mahsulotlar)', 'Остатки склада (топ товары)', 'Warehouse stock (top products)')} icon={Package}>
              {(() => {
                const merged = {};
                visibleCompanies.forEach(co => (perCompany[co.id]?.topProducts || []).forEach(p => {
                  const name = p.name || 'N/A';
                  merged[name] = (merged[name] || 0) + Number(p.value || 0);
                }));
                const data = Object.entries(merged)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8);
                if (data.length === 0) {
                  return <EmptyNote icon={Package} text={t('Maʼlumot yo‘q', 'Нет данных', 'No data')} />;
                }
                return (
                  <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 24)}>
                    <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatAxisTick} />
                      <YAxis
                        type="category" dataKey="name" width={120} interval={0}
                        tickLine={false} axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => truncate(v, 16)}
                      />
                      <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="value" name={t('Qiymat', 'Стоимость', 'Value')} fill="#1D9E75" barSize={18} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>

            <ChartCard title={t('Kompaniyalar bo‘yicha sklad', 'Склад по компаниям', 'Stock by company')} icon={BarChart3}>
              {(() => {
                // Top-N + "Other" so the chart stays compact even with 20+ companies.
                const TOP_N = 8;
                const allCompanyData = visibleCompanies
                  .map(co => ({ name: co.company_name, value: perCompany[co.id]?.stockValue || 0 }))
                  .sort((a, b) => b.value - a.value);
                const top = allCompanyData.slice(0, TOP_N);
                const rest = allCompanyData.slice(TOP_N);
                const otherSum = sum(rest.map(c => c.value));
                const companyData = otherSum > 0
                  ? [...top, { name: `${t('Boshqalar', 'Другие', 'Other')} (${rest.length})`, value: otherSum }]
                  : top;
                if (companyData.length === 0) {
                  return <EmptyNote icon={BarChart3} text={t('Maʼlumot yo‘q', 'Нет данных', 'No data')} />;
                }
                return (
                  <ResponsiveContainer width="100%" height={Math.max(200, companyData.length * 32 + 24)}>
                    <BarChart layout="vertical" data={companyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatAxisTick} />
                      <YAxis
                        type="category" dataKey="name" width={130} interval={0}
                        tickLine={false} axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => truncate(v, 17)}
                      />
                      <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="value" name={t('Sklad qiymati', 'Стоимость склада', 'Stock value')} fill="#185FA5" barSize={18} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>
          </div>
        )}

        {/* Construction */}
        {show('construction') && (
          <SectionCard
            icon={HardHat}
            title={t('Qurilish', 'Строительство', 'Construction')}
            chip="bg-amber-50 text-amber-600"
            cells={[
              { label: t('Obyektlar', 'Объекты', 'Projects'), value: fmtCompact(aggOf(d => (d.constructionProjects || []).length)) },
              { label: t('Shartnoma summasi', 'Сумма контрактов', 'Contracts value'), value: fmtCompact(aggOf(d => sum((d.constructionProjects || []).map(p => Number(p.contract_amount || 0))))) },
              { label: t('Faol obyektlar', 'Активные', 'Active'), value: fmtCompact(aggOf(d => (d.constructionProjects || []).filter(p => ['in_progress', 'active'].includes(p.status)).length)) },
              {
                label: t('Kechikkan', 'С задержкой', 'Delayed'),
                value: fmtCompact(aggOf(d => (d.constructionProjects || []).filter(p => p.status === 'delayed').length)),
                cls: aggOf(d => (d.constructionProjects || []).filter(p => p.status === 'delayed').length) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* Construction projects table */}
        {show('construction') && (
          <div className="glass-card bg-white/80 border border-slate-200/60 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <HardHat className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">{t('Faol obyektlar', 'Активные объекты', 'Active projects')}</h3>
            </div>
            {(() => {
              const all = [];
              visibleCompanies.forEach(co => {
                (perCompany[co.id]?.constructionProjects || []).forEach(p => all.push({ ...p, _coName: co.company_name }));
              });
              if (all.length === 0) {
                return <EmptyNote icon={HardHat} text={t('Hozircha obyektlar yo‘q', 'Пока нет объектов', 'No active projects')} />;
              }
              all.sort((a, b) => (b.progress || 0) - (a.progress || 0));
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <th className="text-left font-medium py-2 pl-1">{t('Obyekt', 'Объект', 'Project')}</th>
                        <th className="text-left font-medium py-2 w-[220px]">{t('Progress', 'Прогресс', 'Progress')}</th>
                        <th className="text-right font-medium py-2">{t('Summa', 'Сумма', 'Budget')}</th>
                        <th className="text-right font-medium py-2 pr-2">{t('Holati', 'Статус', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.slice(0, 10).map(p => {
                        const pct = Math.max(0, Math.min(100, Number(p.progress || 0)));
                        const sc = PROJECT_STATUS_COLOR[p.status] || PROJECT_STATUS_COLOR.draft;
                        const barColor = p.status === 'delayed' ? '#EF9F27' : pct >= 90 ? '#1D9E75' : '#185FA5';
                        return (
                          <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 pl-1">
                              <div className="font-medium text-slate-800">{p.name || p.code}</div>
                              <div className="text-[10px] text-slate-400">{p._coName}</div>
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500 w-[32px] text-right tabular-nums">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="text-right py-2.5 font-medium tabular-nums">{fmtCompact(p.contract_amount || 0)}</td>
                            <td className="text-right py-2.5 pr-2">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.fg }}>
                                {p.status
                                  ? (STATUS_LABEL[p.status] ? t(...STATUS_LABEL[p.status]) : p.status)
                                  : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* HR */}
        {show('hr') && (
          <SectionCard
            icon={Users}
            title={t('Kadrlar', 'Кадры', 'HR')}
            chip="bg-indigo-50 text-indigo-600"
            colsCls="md:grid-cols-3 xl:grid-cols-5"
            cells={[
              { label: t('Xodimlar', 'Сотрудники', 'Employees'), value: fmtCompact(aggOf(d => d.totalEmployees || 0)) },
              { label: t('Faol', 'Активных', 'Active'), value: fmtCompact(aggOf(d => d.activeEmployees || 0)) },
              { label: t('Maosh fondi', 'Зарплатный фонд', 'Salary fund'), value: fmtCompact(aggOf(d => d.salaryFund || 0)) },
              { label: t('Hisoblangan FOT', 'Начисленный ФОТ', 'Payroll fund'), value: fmtCompact(aggOf(d => d.payrollFund || 0)) },
              {
                label: t("To'lanmagan ish haqi", 'Невыплаченная ЗП', 'Unpaid payroll'),
                value: fmtCompact(aggOf(d => d.payrollUnpaid || 0)),
                cls: aggOf(d => d.payrollUnpaid || 0) > 0 ? 'text-rose-600' : undefined,
              },
            ]}
          />
        )}

        {/* HR chart */}
        {show('hr') && visibleCompanies.length > 1 && (
          <ChartCard title={t('Kompaniyalar bo‘yicha xodimlar', 'Сотрудники по компаниям', 'Employees by company')} icon={Users}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={visibleCompanies.map(co => ({
                  name: co.company_name,
                  active: perCompany[co.id]?.activeEmployees || 0,
                  total: perCompany[co.id]?.totalEmployees || 0,
                }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => truncate(v, 14)} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <Bar dataKey="total" name={t('Jami', 'Всего', 'Total')} fill="#185FA5" barSize={14} radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name={t('Faol', 'Активных', 'Active')} fill="#1D9E75" barSize={14} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Summary table */}
        <div className="glass-card bg-white/80 border border-slate-200/60 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">
                {t('Kompaniyalar bo‘yicha jamlanma', 'Сводка по компаниям', 'Company summary')}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {visibleCompanies.length} {t('kompaniya', visibleCompanies.length === 1 ? 'компания' : 'компаний', visibleCompanies.length === 1 ? 'company' : 'companies')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="text-left font-medium py-2">{t('Kompaniya', 'Компания', 'Company')}</th>
                  {show('finance') && (<>
                    <th className="text-right font-medium py-2">{t('Tushum', 'Выручка', 'Revenue')}</th>
                    <th className="text-right font-medium py-2">{t('Xarajat', 'Расходы', 'Expenses')}</th>
                    <th className="text-right font-medium py-2">{t('Foyda', 'Прибыль', 'Profit')}</th>
                    <th className="text-right font-medium py-2">{t('Debitorlar', 'Дебиторы', 'Debtors')}</th>
                    <th className="text-right font-medium py-2">{t('Kreditorlar', 'Кредиторы', 'Creditors')}</th>
                  </>)}
                  {show('inventory') && (<>
                    <th className="text-right font-medium py-2">{t('Birliklar', 'Единицы', 'Units')}</th>
                    <th className="text-right font-medium py-2">{t('Sklad qiymati', 'Стоимость', 'Stock value')}</th>
                    <th className="text-right font-medium py-2">{t('Kam qoldiq', 'Низ. остаток', 'Low stock')}</th>
                  </>)}
                  {show('construction') && (
                    <th className="text-right font-medium py-2">{t('Obyektlar', 'Объекты', 'Projects')}</th>
                  )}
                  {show('hr') && (<>
                    <th className="text-right font-medium py-2">{t('Xodimlar', 'Сотрудники', 'Employees')}</th>
                    <th className="text-right font-medium py-2">{t('Maosh fondi', 'ЗП фонд', 'Salary fund')}</th>
                    <th className="text-right font-medium py-2">{t('Hisoblangan FOT', 'Начисл. ФОТ', 'Payroll fund')}</th>
                    <th className="text-right font-medium py-2">{t("To'lanmagan", 'Невыплач.', 'Unpaid')}</th>
                  </>)}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {visibleCompanies.map((co) => {
                  const d = perCompany[co.id] || {};
                  const pa = paletteFor(co);
                  return (
                    <tr key={co.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: pa.l, color: pa.d }}>
                            {initials(co.company_name)}
                          </div>
                          <span className="font-medium text-slate-800">{co.company_name}</span>
                        </div>
                      </td>
                      {show('finance') && (<>
                        <td className="text-right py-2.5">{fmtCompact(d.revenue || 0)}</td>
                        <td className="text-right py-2.5">{fmtCompact(d.expenses || 0)}</td>
                        <td className={`text-right py-2.5 font-semibold ${(d.profit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {fmtCompact(d.profit || 0)}
                        </td>
                        <td className="text-right py-2.5">{fmtCompact(d.deb || 0)}</td>
                        <td className="text-right py-2.5">{fmtCompact(d.cred || 0)}</td>
                      </>)}
                      {show('inventory') && (<>
                        <td className="text-right py-2.5">{fmtCompact(d.stockUnits || 0)}</td>
                        <td className="text-right py-2.5 font-medium">{fmtCompact(d.stockValue || 0)}</td>
                        <td className={`text-right py-2.5 ${(d.lowStockCount || 0) > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{d.lowStockCount || 0}</td>
                      </>)}
                      {show('construction') && (
                        <td className="text-right py-2.5">{(d.constructionProjects || []).length}</td>
                      )}
                      {show('hr') && (<>
                        <td className="text-right py-2.5">{d.totalEmployees || 0}</td>
                        <td className="text-right py-2.5">{fmtCompact(d.salaryFund || 0)}</td>
                        <td className="text-right py-2.5">{fmtCompact(d.payrollFund || 0)}</td>
                        <td className={`text-right py-2.5 ${(d.payrollUnpaid || 0) > 0 ? 'text-rose-600 font-semibold' : ''}`}>{fmtCompact(d.payrollUnpaid || 0)}</td>
                      </>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
