import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import apiClient from '@/api/client';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

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
  { id: 'hr', uz: 'Kadrlar', ru: 'Кадры', en: 'HR' },
];

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

// Fetch helper that overrides X-Organization-ID header
const fetchForOrg = async (orgId, url, params = {}) => {
  try {
    const res = await apiClient.get(url, {
      params,
      headers: { 'X-Organization-ID': orgId },
    });
    return res.data?.data ?? res.data;
  } catch (e) {
    console.warn(`[DirectorDashboard] ${url} for ${orgId} failed`, e?.response?.status);
    return null;
  }
};

export default function DirectorDashboard() {
  const { language } = useLanguage();
  const { companies, isLoading: companiesLoading } = useCompany();

  const [selectedIds, setSelectedIds] = useState(new Set()); // empty = all
  const [period, setPeriod] = useState('month');
  const [section, setSection] = useState('all');
  const [currency, setCurrency] = useState('UZS');
  const [clock, setClock] = useState(new Date());

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

  // Fetch data per company in parallel
  const loadAll = useCallback(async () => {
    if (!companies || companies.length === 0) return;
    setLoading(true);
    const months = monthRange(6);

    const results = await Promise.all(companies.map(async (co) => {
      const [contacts, invoices, expenses] = await Promise.all([
        fetchForOrg(co.id, '/contacts', { page_size: 5000 }),
        fetchForOrg(co.id, '/finance/invoices', { page_size: 5000 }),
        fetchForOrg(co.id, '/finance/expenses', { page_size: 5000 }),
      ]);

      const contactList = Array.isArray(contacts) ? contacts : (contacts?.items || []);
      const invList = Array.isArray(invoices) ? invoices : (invoices?.items || []);
      const expList = Array.isArray(expenses) ? expenses : (expenses?.items || []);

      // AR = sum of positive balances (they owe us); AP = sum of negative (we owe them)
      let deb = 0, cred = 0;
      contactList.forEach(c => {
        const b = Number(c.current_balance || 0);
        if (b > 0) deb += b;
        else if (b < 0) cred += Math.abs(b);
      });

      // Revenue: sum of invoice totals over last 6 months by month
      const monthlyRev = months.map(m => 0);
      let totalRev = 0;
      invList.forEach(inv => {
        const dateStr = inv.invoice_date || inv.date || inv.created_at;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const total = Number(inv.total_amount || inv.total || inv.amount || 0);
        totalRev += total;
        const idx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
        if (idx >= 0) monthlyRev[idx] += total;
      });

      // Expenses: sum + breakdown by category (current month for donut)
      let totalExp = 0;
      const expByCat = {};
      const now = new Date();
      expList.forEach(e => {
        const amt = Number(e.amount || 0);
        totalExp += amt;
        const dateStr = e.date || e.expense_date || e.claim_date;
        const d = dateStr ? new Date(dateStr) : null;
        if (d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          const cat = e.category || e.category_name || 'other';
          expByCat[cat] = (expByCat[cat] || 0) + amt;
        }
      });

      return [co.id, {
        revenue: totalRev,
        expenses: totalExp,
        profit: totalRev - totalExp,
        deb,
        cred,
        monthlyRev,
        expenseBreakdown: expByCat,
      }];
    }));

    setPerCompany(Object.fromEntries(results));
    setLoading(false);
  }, [companies]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const months = useMemo(() => monthRange(6), []);

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
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E1F5EE] rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
            <span className="text-[11px] text-[#085041] font-semibold">Live</span>
          </div>
        </div>
        <span className="text-[11px] text-[#999]">
          {clock.toLocaleString(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl mb-3 overflow-hidden">
        <div className="flex items-center border-b border-[#F0F0F0] min-h-[46px]">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-4 min-w-[96px] border-r border-[#F0F0F0] self-stretch flex items-center">
            {t('Kompaniya', 'Компания', 'Company')}
          </div>
          <div className="flex items-center gap-1 px-3.5 py-2 flex-1 overflow-x-auto">
            <button
              onClick={selectAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${allMode ? 'border-[#185FA5] border-[1.5px] bg-[#E6F1FB]' : 'border-[#E0E0E0] hover:bg-[#F8F8F8]'}`}
            >
              <div className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center bg-[#E6F1FB] text-[#0C447C]">ALL</div>
              <span className={`text-xs font-medium ${allMode ? 'text-[#0C447C]' : 'text-[#1a1a1a]'}`}>{t('Barchasi', 'Все компании', 'All companies')}</span>
            </button>
            {(companies || []).map((co, idx) => {
              const pa = PAL[idx % PAL.length];
              const on = !allMode && selectedIds.has(co.id);
              return (
                <button
                  key={co.id}
                  onClick={() => toggleCompany(co.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${on ? 'border-[1.5px]' : 'border-[#E0E0E0] hover:bg-[#F8F8F8]'}`}
                  style={on ? { borderColor: pa.c, backgroundColor: pa.l } : {}}
                >
                  <div className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: pa.l, color: pa.d }}>
                    {initials(co.company_name)}
                  </div>
                  <span className="text-xs font-medium" style={on ? { color: pa.d, fontWeight: 600 } : { color: '#1a1a1a' }}>
                    {co.company_name}
                  </span>
                </button>
              );
            })}
          </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        <MetricCard label={t('Tushum', 'Выручка', 'Revenue')} value={agg.revenue} color="#185FA5" />
        <MetricCard label={t('Foyda', 'Прибыль', 'Profit')} value={agg.profit} color="#1D9E75" />
        <MetricCard label={t('Debitorlar', 'Дебиторы', 'Debtors')} value={agg.deb} color="#E24B4A" />
        <MetricCard label={t('Kreditorlar', 'Кредиторы', 'Creditors')} value={agg.cred} color="#EF9F27" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-2.5">
        <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-xl p-3.5">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-[#1a1a1a]">{t('Oylar bo‘yicha tushum', 'Выручка по месяцам', 'Revenue by month')}</div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] font-medium">Live</span>
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

      {/* Summary table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-3.5">
        <div className="text-xs font-semibold text-[#1a1a1a] mb-2">
          {t('Kompaniyalar bo‘yicha jamlanma', 'Сводка по компаниям', 'Company summary')}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#888] border-b border-[#F0F0F0]">
              <th className="text-left py-1.5">{t('Kompaniya', 'Компания', 'Company')}</th>
              <th className="text-right py-1.5">{t('Tushum', 'Выручка', 'Revenue')}</th>
              <th className="text-right py-1.5">{t('Xarajat', 'Расходы', 'Expenses')}</th>
              <th className="text-right py-1.5">{t('Foyda', 'Прибыль', 'Profit')}</th>
              <th className="text-right py-1.5">{t('Debitorlar', 'Дебиторы', 'Debtors')}</th>
              <th className="text-right py-1.5">{t('Kreditorlar', 'Кредиторы', 'Creditors')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleCompanies.map((co, idx) => {
              const d = perCompany[co.id] || { revenue: 0, expenses: 0, profit: 0, deb: 0, cred: 0 };
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
                  <td className="text-right">{fmtCompact(d.revenue)}</td>
                  <td className="text-right">{fmtCompact(d.expenses)}</td>
                  <td className="text-right" style={{ color: d.profit >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 600 }}>
                    {fmtCompact(d.profit)}
                  </td>
                  <td className="text-right">{fmtCompact(d.deb)}</td>
                  <td className="text-right">{fmtCompact(d.cred)}</td>
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
