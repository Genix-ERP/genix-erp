import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

const statusColors = {
  prospect: "bg-yellow-100 text-yellow-800 border-yellow-200",
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  churned: "bg-red-100 text-red-800 border-red-200"
};

export default function RecentCustomers({ customers }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--genix-blue)]" />
          {t('recent_customers')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {customers.length > 0 ? (
          <div className="space-y-4">
            {customers.slice(0, 5).map((customer) => (
              <div key={customer.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {customer.company_name?.charAt(0) || 'C'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{customer.company_name}</p>
                    <p className="text-sm text-slate-500">{customer.contact_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={statusColors[customer.status]}>
                    {t(customer.status)}
                  </Badge>
                  {customer.monthly_value && (
                    <p className="text-sm text-slate-600 mt-1">
                      ${customer.monthly_value.toLocaleString()}/mo
                    </p>
                  )}
                </div>
              </div>
            ))}
            <Link to={createPageUrl("Customers")}>
              <Button variant="outline" className="w-full mt-4">
                {t('view_all_customers')} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{t('no_customers_yet')}</p>
            <Link to={createPageUrl("Customers")}>
              <Button className="mt-4">{t('add_first_customer')}</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}