
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function COGSCalculator({ items, movements }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [cogsCalculations, setCogsCalculations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateFIFOCOGS = useCallback((item, saleQuantity) => {
    // Simulate FIFO calculation for demo
    const avgCost = item.unit_cost || 0;
    return {
      method: 'FIFO',
      unitCost: avgCost,
      totalCost: avgCost * saleQuantity,
      explanation: `FIFO: Using oldest stock first at $${avgCost.toFixed(2)} per unit`
    };
  }, []); // No external dependencies

  const calculateWACCOGS = useCallback((item, saleQuantity) => {
    // Simulate WAC calculation for demo
    const avgCost = item.unit_cost || 0;
    return {
      method: 'WAC',
      unitCost: avgCost,
      totalCost: avgCost * saleQuantity,
      explanation: `Weighted Average: $${avgCost.toFixed(2)} per unit based on inventory pool`
    };
  }, []); // No external dependencies

  const calculateLIFOCOGS = useCallback((item, saleQuantity) => {
    // Simulate LIFO calculation for demo
    const avgCost = (item.unit_cost || 0) * 1.05; // Slightly higher for demo
    return {
      method: 'LIFO',
      unitCost: avgCost,
      totalCost: avgCost * saleQuantity,
      explanation: `LIFO: Using newest stock first at $${avgCost.toFixed(2)} per unit`
    };
  }, []); // No external dependencies

  const calculateCOGS = useCallback(() => {
    setIsCalculating(true);
    
    // Simulate COGS calculations for recent outbound movements
    const calculations = items.slice(0, 10).map((item) => {
      const sampleSaleQty = Math.floor(Math.random() * 50) + 10;
      
      const fifo = calculateFIFOCOGS(item, sampleSaleQty);
      const wac = calculateWACCOGS(item, sampleSaleQty);
      const lifo = calculateLIFOCOGS(item, sampleSaleQty);

      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        saleQuantity: sampleSaleQty,
        currentMethod: item.costing_method || 'fifo',
        calculations: { fifo, wac, lifo }
      };
    });

    setCogsCalculations(calculations);
    setIsCalculating(false);
  }, [items, calculateFIFOCOGS, calculateWACCOGS, calculateLIFOCOGS]); // Dependencies for calculateCOGS

  useEffect(() => {
    calculateCOGS();
  }, [calculateCOGS]); // Now calculateCOGS is stable

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
              onClick={calculateCOGS}
              disabled={isCalculating}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isCalculating ? t('loading') : t('recalculate_cogs')}
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
                {cogsCalculations.map((calc) => {
                  const compliance = getComplianceStatus(calc.currentMethod);
                  const ComplianceIcon = compliance.icon;
                  
                  return (
                    <TableRow key={calc.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div>
                          <p className="font-medium">{calc.name}</p>
                          <p className="text-sm text-slate-500">{calc.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>{calc.saleQuantity}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getMethodColor(calc.currentMethod)}>
                            {calc.currentMethod?.toUpperCase() || 'FIFO'}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <ComplianceIcon className={`w-3 h-3 ${compliance.status === 'compliant' ? 'text-green-500' : 'text-orange-500'}`} />
                            <span className="text-xs text-slate-500">{compliance.text}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">${calc.calculations.fifo.totalCost.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">${calc.calculations.fifo.unitCost.toFixed(2)}/unit</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">${calc.calculations.wac.totalCost.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">${calc.calculations.wac.unitCost.toFixed(2)}/unit</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">${calc.calculations.lifo.totalCost.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">${calc.calculations.lifo.unitCost.toFixed(2)}/unit</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {(() => {
                            const fifo = calc.calculations.fifo.totalCost;
                            const current = calc.calculations[calc.currentMethod]?.totalCost || fifo;
                            const diff = current - fifo;
                            const pctDiff = fifo > 0 ? ((diff / fifo) * 100) : 0;
                            
                            return (
                              <div className={`${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                                {diff > 0 ? '+' : ''}${diff.toFixed(2)}
                                <div className="text-xs">({pctDiff.toFixed(1)}%)</div>
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {cogsCalculations.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('financial_impact_summary')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">{t('total_fifo_cogs')}</div>
                  <div className="text-lg text-green-600">
                    ${cogsCalculations.reduce((sum, calc) => sum + calc.calculations.fifo.totalCost, 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('total_wac_cogs')}</div>
                  <div className="text-lg text-blue-600">
                    ${cogsCalculations.reduce((sum, calc) => sum + calc.calculations.wac.totalCost, 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('total_lifo_cogs')}</div>
                  <div className="text-lg text-orange-600">
                    ${cogsCalculations.reduce((sum, calc) => sum + calc.calculations.lifo.totalCost, 0).toFixed(2)}
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
