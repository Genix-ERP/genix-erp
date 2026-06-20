import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import apiClient from '@/api/client';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { Loader2, ChevronDown, Check, Search, X } from 'lucide-react';

const PAL = [
  { c: '#185FA5', l: '#E6F1FB', d: '#0C447C' },
  { c: '#1D9E75', l: '#E1F5EE', d: '#085041' },
  { c: '#534AB7', l: '#EEEDFE', d: '#3C3489' },
  { c: '#D85A30', l: '#FAECE7', d: '#712B13' },
  { c: '#BA7517', l: '#FAEEDA', d: '#633806' },
];

const EC = ['#185FA5', '#1D9E75', '#EF9F27', '#888780', '#534AB7'];

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

const initials = (name) => (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtMln = (n) => `${(n / 1_000_000).toFixed(1)} mln`;
const fmtCompact = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
};
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

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

  // Initialize: select all companies
  useEffect(() => {
    if (companies && companies.length && selectedIds.size === 0) {
      // 'all' mode by default — empty set means all
    }
  }, [companies]);

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
          constructionProjects: Array.isArray(row.construction_projects) ? row.construction_projects : [],
        };
      });
      setPerCompany(next);
    } catch (e) {
      console.warn('[DirectorDashboard] /reports/director-summary failed', e?.response?.status, e?.response?.data);
      setPerCompany({});
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

  // Expense donut data (sum across visible)
  const expenseDonutData = useMemo(() => {
    const merged = {};
    visibleCompanies.forEach(co => {
      const d = perCompany[co.id];
      if (!d) return;
      Object.entries(d.expenseBreakdown).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + v;
      });
    });
    return Object.entries(merged).map(([name, value]) => ({ name, value }));
  }, [visibleCompanies, perCompany]);

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
  const isOn = (id) => allMode || selectedIds.has(id);

  const t = (uz, ru, en) => language === 'uz' ? uz : language === 'ru' ? ru : en;

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#F5F5F5] min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 px-5 bg-white border border-[#E8E8E8] rounded-xl mb-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-[#1a1a1a]">{t('Direktor paneli', 'Панель директора', 'Director Dashboard')}</div>
        </div>
        <span className="text-[11px] text-[#999]">
          {clock.toLocaleString(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl mb-3">
        <div className="flex items-center border-b border-[#F0F0F0] min-h-[46px] relative rounded-t-xl">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-4 min-w-[96px] border-r border-[#F0F0F0] self-stretch flex items-center">
            {t('Kompaniya', 'Компания', 'Company')}
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 flex-1">
            {/* Selector button */}
            <button
              onClick={() => setCompanyPickerOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E0E0E0] bg-white hover:bg-[#F8F8F8] transition-colors min-w-[240px] max-w-[420px]"
            >
              <span className="text-xs font-medium text-[#1a1a1a] truncate flex-1 text-left">
                {allMode
                  ? t('Barcha kompaniyalar', 'Все компании', 'All companies') + ` (${(companies || []).length})`
                  : visibleCompanies.length === 1
                    ? visibleCompanies[0].company_name
                    : t(`${visibleCompanies.length} ta kompaniya`, `${visibleCompanies.length} компаний`, `${visibleCompanies.length} companies`)
                }
              </span>
              <ChevronDown className={`w-4 h-4 text-[#666] transition-transform ${companyPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Selected chips (first few, for quick deselect) */}
            {!allMode && visibleCompanies.slice(0, 3).map((co, idx) => {
              const origIdx = (companies || []).findIndex(c => c.id === co.id);
              const pa = PAL[(origIdx >= 0 ? origIdx : idx) % PAL.length];
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
              <span className="text-xs text-[#666] font-medium">+{visibleCompanies.length - 3}</span>
            )}
          </div>

          {/* Dropdown panel */}
          {companyPickerOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCompanyPickerOpen(false)} />
              <div className="absolute top-full left-[96px] mt-1 bg-white border border-[#E0E0E0] rounded-xl shadow-lg z-40 w-[420px] max-h-[420px] flex flex-col overflow-hidden">
                <div className="p-2 border-b border-[#F0F0F0] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#999] ml-1" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    placeholder={t('Qidirish...', 'Поиск...', 'Search...')}
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
                <div className="px-2 py-1.5 border-b border-[#F0F0F0] flex items-center justify-between">
                  <button
                    onClick={selectAll}
                    className="text-xs font-medium text-[#185FA5] hover:underline px-2"
                  >
                    {allMode
                      ? t('Tanlovni tozalash', 'Очистить выбор', 'Clear selection')
                      : t('Barchasini tanlash', 'Выбрать все', 'Select all')
                    }
                  </button>
                  <span className="text-[11px] text-[#999] px-2">
                    {allMode ? (companies || []).length : selectedIds.size} / {(companies || []).length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {(companies || [])
                    .filter(co => !companySearch || (co.company_name || '').toLowerCase().includes(companySearch.toLowerCase()))
                    .map((co, idx) => {
                      const origIdx = (companies || []).findIndex(c => c.id === co.id);
                      const pa = PAL[origIdx % PAL.length];
                      const checked = allMode || selectedIds.has(co.id);
                      return (
                        <button
                          key={co.id}
                          onClick={() => toggleCompany(co.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors text-left"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-[#185FA5] border-[#185FA5]' : 'border-[#CCC]'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pa.l, color: pa.d }}>
                            {initials(co.company_name)}
                          </div>
                          <span className="text-xs font-medium text-[#1a1a1a] truncate">{co.company_name}</span>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center min-h-[46px]">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-4 min-w-[96px] border-r border-[#F0F0F0] self-stretch flex items-center">
            {t('Davr', 'Период', 'Period')}
          </div>
          <div className="flex items-center gap-1 px-3.5 py-2">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${period === opt.id ? 'bg-[#E6F1FB] text-[#0C447C] border border-[#B5D4F4]' : 'text-[#666] hover:bg-[#F5F5F5]'}`}
              >
                {opt[language] || opt.en}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-[#F0F0F0] mx-2" />
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-4 flex items-center">
            {t('Valyuta', 'Валюта', 'Currency')}
          </div>
          <div className="flex items-center gap-1 px-3.5 py-2">
            {['UZS', 'USD'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${currency === c ? 'bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB]' : 'text-[#666] hover:bg-[#F5F5F5]'}`}
              >
                {c === 'UZS' ? t('Som', 'Сум', 'Sum') : 'USD'}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-[#F0F0F0] mx-2" />
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-4 flex items-center">
            {t("Bo'lim", 'Раздел', 'Section')}
          </div>
          <div className="flex items-center gap-1 px-3.5 py-2 flex-1 overflow-x-auto">
            {SECTION_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSection(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${section === opt.id ? 'bg-[#FAEEDA] text-[#633806] border border-[#FAC775]' : 'text-[#666] hover:bg-[#F5F5F5]'}`}
              >
                {opt[language] || opt.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Strip */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg mb-3" style={{ background: allMode ? '#EFF6FF' : PAL[0].l, color: allMode ? '#0C447C' : PAL[0].d }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 items-center">
            {visibleCompanies.map((co, idx) => (
              <div key={co.id} className="w-1.5 h-1.5 rounded-full" style={{ background: PAL[(companies.findIndex(c => c.id === co.id)) % PAL.length].c }} />
            ))}
          </div>
          <span className="text-xs font-semibold">
            {allMode ? t('Barcha kompaniyalar', 'Все компании', 'All companies') : visibleCompanies.map(c => c.company_name).join(' + ')}
          </span>
        </div>
        <span className="text-[11px] opacity-60">
          {visibleCompanies.length} {t('kompaniya', visibleCompanies.length === 1 ? 'компания' : 'компаний', visibleCompanies.length === 1 ? 'company' : 'companies')}
        </span>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center gap-2 mb-3 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('Maʼlumotlar yuklanmoqda...', 'Загрузка данных...', 'Loading data...')}
        </div>
      )}

      {/* Metric cards */}
      {(section === 'all' || section === 'finance') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <MetricCard label={t('Tushum', 'Выручка', 'Revenue')} value={agg.revenue} color="#185FA5" />
          <MetricCard label={t('Foyda', 'Прибыль', 'Profit')} value={agg.profit} color="#1D9E75" />
          <MetricCard label={t('Debitorlar', 'Дебиторы', 'Debtors')} value={agg.deb} color="#E24B4A" />
          <MetricCard label={t('Kreditorlar', 'Кредиторы', 'Creditors')} value={agg.cred} color="#EF9F27" />
        </div>
      )}

      {(section === 'all' || section === 'inventory') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <MetricCard label={t('Mahsulotlar', 'Товары', 'Products')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.productCount || 0))} color="#185FA5" />
          <MetricCard label={t('Sklad qiymati', 'Стоимость склада', 'Stock value')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.stockValue || 0))} color="#1D9E75" />
          <MetricCard label={t('Birliklar', 'Единицы', 'Units')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.stockUnits || 0))} color="#534AB7" />
          <MetricCard label={t('Kam qoldiq', 'Низкий остаток', 'Low stock')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.lowStockCount || 0))} color="#E24B4A" />
        </div>
      )}

      {(section === 'all' || section === 'construction') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <MetricCard label={t('Obyektlar', 'Объекты', 'Projects')} value={sum(visibleCompanies.map(c => (perCompany[c.id]?.constructionProjects || []).length))} color="#185FA5" />
          <MetricCard label={t('Shartnoma summasi', 'Сумма контрактов', 'Contracts')} value={sum(visibleCompanies.flatMap(c => (perCompany[c.id]?.constructionProjects || []).map(p => Number(p.contract_amount || 0))))} color="#1D9E75" />
          <MetricCard label={t('Faol obyektlar', 'Активные', 'Active')} value={sum(visibleCompanies.flatMap(c => (perCompany[c.id]?.constructionProjects || []).filter(p => ['in_progress', 'active'].includes(p.status)).map(() => 1)))} color="#534AB7" />
          <MetricCard label={t('Kechikkan', 'С задержкой', 'Delayed')} value={sum(visibleCompanies.flatMap(c => (perCompany[c.id]?.constructionProjects || []).filter(p => p.status === 'delayed').map(() => 1)))} color="#E24B4A" />
        </div>
      )}

      {(section === 'all' || section === 'hr') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <MetricCard label={t('Xodimlar', 'Сотрудники', 'Employees')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.totalEmployees || 0))} color="#185FA5" />
          <MetricCard label={t('Faol', 'Активных', 'Active')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.activeEmployees || 0))} color="#1D9E75" />
          <MetricCard label={t('Maosh fondi', 'Зарплатный фонд', 'Salary fund')} value={sum(visibleCompanies.map(c => perCompany[c.id]?.salaryFund || 0))} color="#534AB7" />
          <MetricCard label={t('Kompaniyalar', 'Компаний', 'Companies')} value={visibleCompanies.length} color="#EF9F27" />
        </div>
      )}

      {/* Charts row 1 — finance only */}
      {(section === 'all' || section === 'finance') && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-2.5">
        <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-xl p-3.5">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-[#1a1a1a]">{t('Oylar bo‘yicha tushum', 'Выручка по месяцам', 'Revenue by month')}</div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                <Tooltip formatter={(v) => fmtCompact(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {visibleCompanies.map((co, idx) => (
                  <Line
                    key={co.id}
                    type="monotone"
                    dataKey={co.company_name || co.id}
                    stroke={PAL[(companies.findIndex(c => c.id === co.id)) % PAL.length].c}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-[#1a1a1a]">{t('Xarajatlar tarkibi', 'Структура расходов', 'Expense structure')}</div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E6F1FB] text-[#0C447C] font-medium">{new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' })}</span>
          </div>
          <div className="h-[200px]">
            {expenseDonutData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                {t('Maʼlumot yo‘q', 'Нет данных', 'No data')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseDonutData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {expenseDonutData.map((entry, idx) => (
                      <Cell key={idx} fill={EC[idx % EC.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCompact(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Warehouse diagram: top products/materials by stock value (aggregated across visible companies) */}
      {(section === 'all' || section === 'inventory') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-2.5">
          <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-[#1a1a1a]">{t('Sklad qoldiqlari', 'Остатки склада', 'Warehouse stock')}</div>
            </div>
            <div className="h-[220px]">
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
                  return <div className="flex items-center justify-center h-full text-xs text-slate-400">{t('Maʼlumot yo‘q', 'Нет данных', 'No data')}</div>;
                }
                // Truncate long warehouse names on the X-axis tick so
                // they don't overlap; full name still shown in tooltip
                // (tooltip reads the raw `name` field, tickFormatter
                // only affects the rendered tick label).
                const truncate = (s, n = 10) =>
                  typeof s === 'string' && s.length > n ? s.slice(0, n - 1) + '…' : s;
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9 }}
                        interval={0}
                        textAnchor="middle"
                        height={28}
                        tickFormatter={(v) => truncate(v, 10)}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCompact} />
                      <Tooltip formatter={(v) => fmtCompact(v)} />
                      <Bar dataKey="value" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5">
            <div className="text-xs font-semibold text-[#1a1a1a] mb-2">
              {t('Kompaniyalar bo‘yicha sklad', 'Склад по компаниям', 'Stock by company')}
            </div>
            {(() => {
              // Horizontal bars (layout="vertical" in Recharts terms:
              // value on X, company on Y) so long company names get a
              // full row each and are readable. Top-N + "Other" so
              // the chart stays compact even with 20+ companies.
              const TOP_N = 8;
              const allCompanyData = visibleCompanies
                .map(co => ({
                  name: co.company_name,
                  value: perCompany[co.id]?.stockValue || 0,
                }))
                .sort((a, b) => b.value - a.value);
              const top = allCompanyData.slice(0, TOP_N);
              const rest = allCompanyData.slice(TOP_N);
              const otherSum = rest.reduce((s, c) => s + c.value, 0);
              const companyData =
                otherSum > 0
                  ? [
                      ...top,
                      {
                        name:
                          t('Boshqalar', 'Другие', 'Other') +
                          ` (${rest.length})`,
                        value: otherSum,
                      },
                    ]
                  : top;
              const truncate = (s, n = 18) =>
                typeof s === 'string' && s.length > n
                  ? s.slice(0, n - 1) + '…'
                  : s;
              // Auto-grow so each bar gets ~26px of vertical space.
              const chartHeight = Math.max(220, companyData.length * 26 + 20);
              if (companyData.length === 0) {
                return (
                  <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                    {t('Maʼlumot yo‘q', 'Нет данных', 'No data')}
                  </div>
                );
              }
              return (
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={companyData}
                      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="rgba(0,0,0,0.04)"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        tickFormatter={fmtCompact}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        width={140}
                        interval={0}
                        tickFormatter={(v) => truncate(v, 18)}
                      />
                      <Tooltip formatter={(v) => fmtCompact(v)} />
                      <Bar
                        dataKey="value"
                        fill="#185FA5"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Construction projects: Активные объекты table */}
      {(section === 'all' || section === 'construction') && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5 mb-2.5">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-[#1a1a1a]">{t('Faol obyektlar', 'Активные объекты', 'Active projects')}</div>
          </div>
          {(() => {
            const all = [];
            visibleCompanies.forEach(co => {
              (perCompany[co.id]?.constructionProjects || []).forEach(p => all.push({ ...p, _coName: co.company_name }));
            });
            if (all.length === 0) {
              return <div className="text-center py-8 text-xs text-slate-400">{t('Hozircha obyektlar yo‘q', 'Пока нет объектов', 'No active projects')}</div>;
            }
            all.sort((a, b) => (b.progress || 0) - (a.progress || 0));
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#888] border-b border-[#F0F0F0]">
                      <th className="text-left py-1.5 pl-1">{t('Obyekt', 'Объект', 'Project')}</th>
                      <th className="text-left py-1.5 w-[220px]">{t('Progress', 'Прогресс', 'Progress')}</th>
                      <th className="text-right py-1.5">{t('Summa', 'Сумма', 'Budget')}</th>
                      <th className="text-right py-1.5 pr-2">{t('Holati', 'Статус', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {all.slice(0, 10).map(p => {
                      const pct = Math.max(0, Math.min(100, Number(p.progress || 0)));
                      const sc = PROJECT_STATUS_COLOR[p.status] || PROJECT_STATUS_COLOR.draft;
                      const barColor = p.status === 'delayed' ? '#EF9F27' : pct >= 90 ? '#1D9E75' : '#185FA5';
                      return (
                        <tr key={p.id} className="border-b border-[#F0F0F0] last:border-0">
                          <td className="py-2 pl-1">
                            <div className="font-medium text-slate-800">{p.name || p.code}</div>
                            <div className="text-[10px] text-slate-500">{p._coName}</div>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-600 w-[32px] text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="text-right py-2 font-medium">{fmtCompact(p.contract_amount || 0)}</td>
                          <td className="text-right py-2 pr-2">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.fg }}>
                              {p.status
                                ? (STATUS_LABEL[p.status]
                                    ? t(...STATUS_LABEL[p.status])
                                    : p.status)
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

      {/* HR section: bar chart of employees per company */}
      {(section === 'all' || section === 'hr') && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5 mb-2.5">
          <div className="text-xs font-semibold text-[#1a1a1a] mb-2">
            {t('Kompaniyalar bo‘yicha xodimlar', 'Сотрудники по компаниям', 'Employees by company')}
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={visibleCompanies.map(co => ({
                  name: co.company_name,
                  active: perCompany[co.id]?.activeEmployees || 0,
                  total: perCompany[co.id]?.totalEmployees || 0,
                }))}
                margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="active" fill="#1D9E75" name={t('Faol', 'Активных', 'Active')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" fill="#185FA5" name={t('Jami', 'Всего', 'Total')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5">
        <div className="text-xs font-semibold text-[#1a1a1a] mb-2">
          {t('Kompaniyalar bo‘yicha jamlanma', 'Сводка по компаниям', 'Company summary')}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#888] border-b border-[#F0F0F0]">
              <th className="text-left py-1.5">{t('Kompaniya', 'Компания', 'Company')}</th>
              {(section === 'all' || section === 'finance') && (<>
                <th className="text-right py-1.5">{t('Tushum', 'Выручка', 'Revenue')}</th>
                <th className="text-right py-1.5">{t('Xarajat', 'Расходы', 'Expenses')}</th>
                <th className="text-right py-1.5">{t('Foyda', 'Прибыль', 'Profit')}</th>
                <th className="text-right py-1.5">{t('Debitorlar', 'Дебиторы', 'Debtors')}</th>
                <th className="text-right py-1.5">{t('Kreditorlar', 'Кредиторы', 'Creditors')}</th>
              </>)}
              {(section === 'all' || section === 'inventory') && (<>
                <th className="text-right py-1.5">{t('Birliklar', 'Единицы', 'Units')}</th>
                <th className="text-right py-1.5">{t('Sklad qiymati', 'Стоимость', 'Stock value')}</th>
                <th className="text-right py-1.5">{t('Kam qoldiq', 'Низ. остаток', 'Low stock')}</th>
              </>)}
              {(section === 'all' || section === 'construction') && (<>
                <th className="text-right py-1.5">{t('Obyektlar', 'Объекты', 'Projects')}</th>
              </>)}
              {(section === 'all' || section === 'hr') && (<>
                <th className="text-right py-1.5">{t('Xodimlar', 'Сотрудники', 'Employees')}</th>
                <th className="text-right py-1.5">{t('Maosh fondi', 'ЗП фонд', 'Salary fund')}</th>
              </>)}
            </tr>
          </thead>
          <tbody>
            {visibleCompanies.map((co, idx) => {
              const d = perCompany[co.id] || {};
              const pa = PAL[(companies.findIndex(c => c.id === co.id)) % PAL.length];
              return (
                <tr key={co.id} className="border-b border-[#F0F0F0] last:border-0">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: pa.l, color: pa.d }}>
                        {initials(co.company_name)}
                      </div>
                      <span className="font-medium">{co.company_name}</span>
                    </div>
                  </td>
                  {(section === 'all' || section === 'finance') && (<>
                    <td className="text-right">{fmtCompact(d.revenue || 0)}</td>
                    <td className="text-right">{fmtCompact(d.expenses || 0)}</td>
                    <td className="text-right" style={{ color: (d.profit || 0) >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 600 }}>
                      {fmtCompact(d.profit || 0)}
                    </td>
                    <td className="text-right">{fmtCompact(d.deb || 0)}</td>
                    <td className="text-right">{fmtCompact(d.cred || 0)}</td>
                  </>)}
                  {(section === 'all' || section === 'inventory') && (<>
                    <td className="text-right">{fmtCompact(d.stockUnits || 0)}</td>
                    <td className="text-right font-medium">{fmtCompact(d.stockValue || 0)}</td>
                    <td className="text-right" style={{ color: (d.lowStockCount || 0) > 0 ? '#A32D2D' : '#888' }}>{d.lowStockCount || 0}</td>
                  </>)}
                  {(section === 'all' || section === 'construction') && (<>
                    <td className="text-right">{(d.constructionProjects || []).length}</td>
                  </>)}
                  {(section === 'all' || section === 'hr') && (<>
                    <td className="text-right">{d.totalEmployees || 0}</td>
                    <td className="text-right">{fmtCompact(d.salaryFund || 0)}</td>
                  </>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5">
      <div className="text-[11px] text-[#888] mb-1">{label}</div>
      <div className="text-[22px] font-bold text-[#1a1a1a]">{fmtCompact(value)}</div>
      <div className="h-[3px] rounded-sm mt-2.5 bg-[#F0F0F0]">
        <div className="h-full rounded-sm transition-all duration-700" style={{ width: '70%', background: color }} />
      </div>
    </div>
  );
}
