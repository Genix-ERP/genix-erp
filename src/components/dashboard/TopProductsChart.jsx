import { useState, useEffect } from "react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { BarChart3 } from "lucide-react";
import apiClient from "@/api/client";

const RANK_COLORS = ["#6C5CE7", "#7C6DF0", "#8C7EF5", "#A29BFE", "#B8B2FF"];

export default function TopProductsChart() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    apiClient.get('/dashboard/top-products')
      .then(res => {
        const data = res.data?.data || [];
        const maxRevenue = data.length > 0 ? data[0].revenue : 0;
        const totalRevenue = data.reduce((s, p) => s + p.revenue, 0);
        setChartData(data.map(p => ({
          ...p,
          displayName: p.name.length > 25 ? p.name.slice(0, 23) + "..." : p.name,
          percentage: totalRevenue > 0 ? ((p.revenue / totalRevenue) * 100).toFixed(1) : 0,
          barWidth: maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0,
        })));
      })
      .catch(() => setChartData([]));
  }, []);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("top_5_products") || "Top 5 Products"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("by_revenue") || "By revenue"}
          </p>
        </div>
        <BarChart3 className="w-4 h-4 text-slate-400" />
      </div>

      {chartData.length > 0 ? (
        <div className="space-y-3">
          {chartData.map((item, i) => (
            <div key={item.name} className="group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-slate-700 truncate flex-1 mr-2" title={item.name}>
                  {item.displayName}
                </p>
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                  {item.percentage}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.barWidth}%`, backgroundColor: RANK_COLORS[i] }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 w-20 text-right">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[200px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <BarChart3 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t("no_data") || "No data"}</p>
        </div>
      )}
    </div>
  );
}
