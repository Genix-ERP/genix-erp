import React from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, Hourglass, Cake, Timer, Users } from 'lucide-react';
import { PAL, ChartCard, GlassTooltip, EmptyNote } from '@/components/shared/DashboardKit';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { formatDate } from '@/utils/formatDate';

const MONTHS = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// "Tahlillar" tab — all data comes from GET /employees/stats in one call.
export default function HRAnalyticsTab({ stats, loading }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const months = MONTHS[language] || MONTHS.uz;

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 h-72 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5">
        <EmptyNote icon={Users} text={t('hr_stats_unavailable') || "Statistika yuklanmadi — sahifani yangilang"} />
      </div>
    );
  }

  const fmtMonth = (m) => {
    const [y, mm] = String(m).split('-');
    const idx = parseInt(mm, 10) - 1;
    return `${months[idx] || mm} ${String(y).slice(2)}`;
  };

  const headcount = (stats.headcount_by_month || []).map(p => ({ ...p, name: fmtMonth(p.month) }));
  const hasFlow = headcount.some(p => p.hires > 0 || p.exits > 0 || p.headcount > 0);

  const deptRaw = (stats.departments || []).filter(d => d.name);
  const unassigned = (stats.departments || []).find(d => !d.name)?.count || 0;
  const top = deptRaw.slice(0, 5);
  const restCount = deptRaw.slice(5).reduce((s, d) => s + d.count, 0);
  const deptData = [
    ...top.map(d => ({ name: d.name, value: d.count })),
    ...(restCount > 0 ? [{ name: t('other') || 'Boshqa', value: restCount }] : []),
  ];

  const tenureLabels = {
    '0-1': `<1 ${t('hr_year') || 'yil'}`,
    '1-3': `1–3 ${t('hr_year') || 'yil'}`,
    '3-5': `3–5 ${t('hr_year') || 'yil'}`,
    '5+': `5+ ${t('hr_year') || 'yil'}`,
  };
  const tenure = (stats.tenure_buckets || []).map(b => ({ name: tenureLabels[b.bucket] || b.bucket, value: b.count }));

  return (
    <div className="space-y-4">
      {/* Headcount dynamics — hires/exits bars + headcount line, 12 months */}
      <ChartCard title={t('hr_headcount_dynamics') || 'Xodimlar soni dinamikasi (12 oy)'} icon={TrendingUp}>
        {hasFlow ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={headcount} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<GlassTooltip format={(v) => v} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
              <Bar name={t('hr_hires') || 'Qabul qilingan'} dataKey="hires" fill={PAL[0].c} barSize={10} radius={[4, 4, 0, 0]} />
              <Bar name={t('hr_exits') || 'Ketgan'} dataKey="exits" fill={PAL[1].c} barSize={10} radius={[4, 4, 0, 0]} />
              <Line name={t('hr_headcount') || 'Umumiy soni'} type="monotone" dataKey="headcount" stroke={PAL[2].c} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyNote icon={TrendingUp} text={t('hr_no_dynamics') || "Hozircha dinamika ma'lumotlari yo'q"} />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department distribution */}
        <ChartCard title={t('hr_dept_distribution') || "Bo'limlar bo'yicha taqsimot"} icon={PieChartIcon}>
          {deptData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                    {deptData.map((d, i) => (
                      <Cell key={d.name} fill={PAL[i % PAL.length].c} />
                    ))}
                  </Pie>
                  <Tooltip content={<GlassTooltip format={(v) => v} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
                </PieChart>
              </ResponsiveContainer>
              {unassigned > 0 && (
                <p className="text-xs text-slate-400 mt-2 text-center">
                  {unassigned} {t('hr_unassigned_dept') || "xodim bo'limga biriktirilmagan"}
                </p>
              )}
            </>
          ) : (
            <EmptyNote
              icon={PieChartIcon}
              text={t('hr_no_departments') || "Xodimlar bo'limlarga biriktirilmagan — Bo'limlar tabidan boshlang"}
            />
          )}
        </ChartCard>

        {/* Tenure distribution */}
        <ChartCard title={t('hr_tenure_distribution') || 'Staj taqsimoti (faol xodimlar)'} icon={Hourglass}>
          {tenure.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tenure} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<GlassTooltip format={(v) => v} />} />
                <Bar name={t('hr_headcount') || 'Xodimlar'} dataKey="value" fill={PAL[0].c} barSize={28} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={Hourglass} text={t('hr_no_tenure') || "Staj ma'lumotlari yo'q"} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Probation ending */}
        <ChartCard title={t('hr_probation_ending') || 'Sinov muddati tugayotganlar (30 kun)'} icon={Timer}>
          {(stats.probation_ending || []).length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {stats.probation_ending.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700 truncate">{p.name}</span>
                  <span className="text-slate-500 tabular-nums ml-3 shrink-0">{formatDate(p.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote icon={Timer} text={t('hr_no_probation') || "Yaqin 30 kunda sinov muddati tugaydiganlar yo'q"} />
          )}
        </ChartCard>

        {/* Upcoming birthdays */}
        <ChartCard title={t('hr_upcoming_birthdays') || "Yaqin tug'ilgan kunlar (30 kun)"} icon={Cake}>
          {(stats.upcoming_birthdays || []).length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {stats.upcoming_birthdays.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700 truncate">{p.name}</span>
                  <span className="text-slate-500 tabular-nums ml-3 shrink-0">{p.date}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote icon={Cake} text={t('hr_no_birthdays') || "Yaqin 30 kunda tug'ilgan kunlar yo'q"} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
