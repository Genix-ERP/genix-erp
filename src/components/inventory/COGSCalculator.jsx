
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import inventoryService from '@/api/services/inventory';

export default function COGSCalculator() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const [cogsData, setCogsData] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const fetchCOGS = useCallback(async () => {
    setIsCalculating(true);
    try {
      const data = await inventoryService.getCOGSData();
      setCogsData(data || []);
    } catch (e) {
      console.error('Failed to fetch COGS data', e);
    } finally {
      setIsCalculating(false);
    }
  }, []);

  useEffect(() => {
    fetchCOGS();
  }, [fetchCOGS]);

  const getMethodColor = (method) => {
    const colors = {
      fifo: "bg-green-100 text-green-800",
      wac: "bg-blue-100 text-blue-800",
      lifo: "bg-orange-100 text-orange-800"
    };
    return colors[method] || colors.fifo;
  };

  const getComplianceStatus = (method) => {
    if (method === 'lifo') {
      return { status: 'warning', text: t('us_gaap_only'), icon: AlertCircle };
    }
    return { status: 'compliant', text: t('ifrs_compliant'), icon: CheckCircle };
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[var(--genix-blue)]" />
              <CardTitle>{t('cogs_calculator')}</CardTitle>
            </div>
            <Button
              onClick={fetchCOGS}
              disabled={isCalculating}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isCalculating ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />{t('loading')}</> : t('recalculate_cogs')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-[var(--genix-light-blue)]/30 rounded-lg">
            <h4 className="font-semibold mb-2">{t('understanding_cogs_methods')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Badge className="bg-green-100 text-green-800 mb-2">{t('fifo_recommended')}</Badge>
                <p>{t('fifo_description')}</p>
              </div>
              <div>
                <Badge className="bg-blue-100 text-blue-800 mb-2">{t('weighted_average')}</Badge>
                <p>{t('weighted_avg_description')}</p>
              </div>
              <div>
                <Badge className="bg-orange-100 text-orange-800 mb-2">{t('lifo_us_only')}</Badge>
                <p>{t('lifo_description')}</p>
              </div>
            </div>
          </div>

          {cogsData.length === 0 && !isCalculating ? (
            <div className="text-center py-8 text-sm text-slate-400">
              {t('no_sales_data') || 'No sales data found. COGS is calculated from confirmed sales orders and completed POS orders.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('item')}</TableHead>
                    <TableHead>{t('sale_qty')}</TableHead>
                    <TableHead>{t('current_method')}</TableHead>
                    <TableHead>{t('fifo_cogs')}</TableHead>
                    <TableHead>{t('wac_cogs')}</TableHead>
                    <TableHead>{t('lifo_cogs')}</TableHead>
                    <TableHead>{t('impact')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cogsData.map((item) => {
                    const compliance = getComplianceStatus(item.costing_method);
                    const ComplianceIcon = compliance.icon;
                    const fifo = item.fifo_total;
                    const current = item.costing_method === 'wac' ? item.wac_total : item.costing_method === 'lifo' ? item.lifo_total : fifo;
                    const diff = current - fifo;
                    const pctDiff = fifo > 0 ? ((diff / fifo) * 100) : 0;

                    return (
                      <TableRow key={item.product_id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-slate-500">{item.product_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{item.sale_qty}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={getMethodColor(item.costing_method)}>
                              {item.costing_method?.toUpperCase() || 'FIFO'}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <ComplianceIcon className={`w-3 h-3 ${compliance.status === 'compliant' ? 'text-green-500' : 'text-orange-500'}`} />
                              <span className="text-xs text-slate-500">{compliance.text}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(item.fifo_total)}</div>
                            <div className="text-xs text-slate-500">{formatCurrency(item.fifo_unit)}/unit</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(item.wac_total)}</div>
                            <div className="text-xs text-slate-500">{formatCurrency(item.wac_unit)}/unit</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(item.lifo_total)}</div>
                            <div className="text-xs text-slate-500">{formatCurrency(item.lifo_unit)}/unit</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`text-sm ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                            <div className="text-xs">({pctDiff.toFixed(1)}%)</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {cogsData.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('financial_impact_summary')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">{t('total_fifo_cogs')}</div>
                  <div className="text-lg text-green-600">
                    {formatCurrency(cogsData.reduce((sum, item) => sum + item.fifo_total, 0))}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('total_wac_cogs')}</div>
                  <div className="text-lg text-blue-600">
                    {formatCurrency(cogsData.reduce((sum, item) => sum + item.wac_total, 0))}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('total_lifo_cogs')}</div>
                  <div className="text-lg text-orange-600">
                    {formatCurrency(cogsData.reduce((sum, item) => sum + item.lifo_total, 0))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
