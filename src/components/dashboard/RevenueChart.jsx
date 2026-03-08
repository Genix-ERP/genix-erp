import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { TrendingUp } from "lucide-react";

export default function RevenueChart({ data }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length >= 3) return data;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const existingMonths = new Set(data.map(d => d.month));
    const padded = [...data];
    for (const m of months) {
      if (!existingMonths.has(m) && padded.length < 6) {
        padded.push({ month: m, revenue: 0 });
      }
    }
    return padded.sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
  }, [data]);

  const total = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('revenue_trends')}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{t('monthly_revenue') || t('revenue')}</p>
        </div>
        {total > 0 && (
          <span className="text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg">
            {formatCurrencyCompact(total)}
          </span>
        )}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={65}
              tickFormatter={(value) => formatCurrencyCompact(value)}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value), t('revenue')]}
              cursor={{ fill: '#f8fafc', radius: 8 }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
                fontSize: '13px'
              }}
            />
            <Bar
              dataKey="revenue"
              fill="#6366f1"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{t('no_revenue_data')}</p>
          <p className="text-xs text-slate-400">{t('start_tracking_revenue')}</p>
        </div>
      )}
    </div>
  );
}
