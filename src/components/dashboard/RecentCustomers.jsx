import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function RecentCustomers({ customers }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{t('recent_customers')}</h3>
        <Link to={createPageUrl("Customers")} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
          {t('view_all_customers')} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {customers.length > 0 ? (
        <div className="space-y-0.5">
          {customers.slice(0, 6).map((customer) => (
            <div key={customer.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-indigo-600 font-semibold text-sm">
                  {customer.company_name?.charAt(0) || 'C'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{customer.company_name}</p>
                {customer.contact_name && (
                  <p className="text-xs text-slate-400 truncate">{customer.contact_name}</p>
                )}
              </div>
              {customer.industry && (
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md hidden sm:block">
                  {customer.industry}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 mb-3">{t('no_customers_yet')}</p>
          <Link to={createPageUrl("Customers")}>
            <button className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">
              {t('add_first_customer')}
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
