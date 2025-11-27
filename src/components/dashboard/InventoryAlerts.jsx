import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function InventoryAlerts({ inventory }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const lowStockItems = inventory.filter(item => 
    item.current_stock <= item.reorder_level
  );

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg h-full">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5 text-[var(--genix-orange)]" />
          {t('inventory_alerts')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {lowStockItems.length > 0 ? (
          <div className="space-y-4">
            {lowStockItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50/80 rounded-lg border border-orange-200/50">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">SKU: {item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                    {item.current_stock} {t('left')}
                  </Badge>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('reorder_at')} {item.reorder_level}
                  </p>
                </div>
              </div>
            ))}
            <Link to={createPageUrl("Inventory")}>
              <Button className="w-full" variant="outline">
                {t('manage_inventory')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('all_inventory_healthy')}</h3>
            <p className="text-sm text-slate-500 text-center">{t('no_restocking_needed')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}