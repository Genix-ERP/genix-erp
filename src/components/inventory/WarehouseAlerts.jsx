import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Package, Clock, Trash2, Timer,
  RefreshCw, Loader2, CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService } from '@/api/services';

const ALERT_CONFIG = {
  low_stock:          { icon: Package,        color: 'border-l-amber-500',    bg: 'bg-amber-50' },
  expiring_lot:       { icon: Clock,          color: 'border-l-orange-500',   bg: 'bg-orange-50' },
  overdue_operation:  { icon: Timer,          color: 'border-l-blue-500',     bg: 'bg-blue-50' },
  step_timeout:       { icon: AlertTriangle,  color: 'border-l-red-500',      bg: 'bg-red-50' },
  anomaly_writeoff:   { icon: Trash2,         color: 'border-l-purple-500',   bg: 'bg-purple-50' },
};

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  info:     'bg-blue-100 text-blue-700',
};

export default function WarehouseAlerts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await inventoryService.getWarehouseAlerts();
      setAlerts(data || []);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const grouped = {};
  alerts.forEach(alert => {
    if (!grouped[alert.type]) grouped[alert.type] = [];
    grouped[alert.type].push(alert);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{t('warehouse_alerts') || 'Warehouse Alerts'}</h3>
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-700">{criticalCount} {t('critical') || 'critical'}</Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700">{warningCount} {t('warnings') || 'warnings'}</Badge>
          )}
          {alerts.length === 0 && !isLoading && (
            <Badge className="bg-green-100 text-green-700 gap-1">
              <CheckCircle2 className="w-3 h-3" />{t('all_clear') || 'All clear'}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="text-slate-500">{t('no_alerts') || 'No active alerts. Everything looks good!'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(grouped).map(([type, typeAlerts]) => {
            const config = ALERT_CONFIG[type] || ALERT_CONFIG.low_stock;
            const Icon = config.icon;
            const typeLabels = {
              low_stock: t('low_stock_alerts') || 'Low Stock',
              expiring_lot: t('expiring_lots') || 'Expiring Lots',
              overdue_operation: t('overdue_operations') || 'Overdue Operations',
              step_timeout: t('step_timeouts') || 'Step Timeouts',
              anomaly_writeoff: t('anomaly_writeoffs') || 'Large Write-offs',
            };

            return (
              <Card key={type} className={`border-l-4 ${config.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {typeLabels[type] || type}
                    <Badge variant="outline" className="text-xs">{typeAlerts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {typeAlerts.slice(0, 5).map((alert, i) => (
                    <div key={i} className={`p-2 rounded-md ${config.bg} text-sm`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-xs">{alert.title}</p>
                        <Badge className={`${SEVERITY_BADGE[alert.severity] || SEVERITY_BADGE.info} text-[10px] shrink-0`}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    </div>
                  ))}
                  {typeAlerts.length > 5 && (
                    <p className="text-xs text-slate-400 text-center">
                      +{typeAlerts.length - 5} {t('more') || 'more'}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
