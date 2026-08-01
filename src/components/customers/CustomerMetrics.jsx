import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, Trophy, Percent } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

// CRM stats row (CRM v2): Jami mijozlar · Ochiq bitimlar (count + summa) ·
// Bu oy yutilgan (summa) · Konversiya % (bu oy). Numbers come from
// GET /leads/stats — no more client-side aggregation over dead entities.
export default function CustomerMetrics({ customers = [], stats = null, language = 'uz' }) {
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const money = (v) => (formatCurrency ? formatCurrency(v || 0) : (v || 0).toLocaleString());

  const openCount = stats?.open_leads ?? 0;
  const openValue = stats?.open_value ?? 0;
  const wonMonthValue = stats?.won_value_month ?? 0;
  const wonMonthCount = stats?.won_this_month ?? 0;
  const conversionMonth = stats?.conversion_month ?? 0;
  const conversionAll = stats?.conversion_rate ?? 0;

  const metricCards = [
    {
      title: t('total_customers'),
      value: customers.length.toLocaleString(),
      sub: null,
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: t('crm_open_deals') || 'Ochiq bitimlar',
      value: openCount.toLocaleString(),
      sub: openValue > 0 ? money(openValue) : null,
      icon: Target,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: t('crm_won_this_month') || 'Bu oy yutilgan',
      value: money(wonMonthValue),
      sub: wonMonthCount > 0 ? `${wonMonthCount} ${t('crm_deals_count') || 'ta bitim'}` : null,
      icon: Trophy,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      title: t('crm_conversion_month') || 'Konversiya % (bu oy)',
      value: `${Math.round(conversionMonth || conversionAll)}%`,
      sub: conversionAll > 0 ? `${t('crm_conversion_all') || 'Umumiy'}: ${Math.round(conversionAll)}%` : null,
      icon: Percent,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
      {metricCards.map((metric, index) => (
        <Card
          key={index}
          className="bg-white border-slate-200/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-500 mb-1 truncate">{metric.title}</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight truncate">{metric.value}</p>
                {metric.sub && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{metric.sub}</p>
                )}
              </div>
              <div className={`${metric.iconBg} p-2.5 rounded-xl shrink-0 ml-2`}>
                <metric.icon className={`w-5 h-5 ${metric.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
