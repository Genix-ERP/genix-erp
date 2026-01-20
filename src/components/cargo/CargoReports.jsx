import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText, TrendingUp, Package, DollarSign, BarChart3, Download
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

export default function CargoReports() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    calculateShipmentCosts,
    SHIPMENT_STATUS
  } = useCargoContext();

  const [reportType, setReportType] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter shipments by status
  const filteredShipments = shipments.filter(s =>
    statusFilter === 'all' || s.status === statusFilter
  );

  // Calculate statistics
  const calculateStats = () => {
    const stats = {
      totalShipments: shipments.length,
      ordered: shipments.filter(s => s.status === SHIPMENT_STATUS.ORDERED).length,
      inTransit: shipments.filter(s => s.status === SHIPMENT_STATUS.IN_TRANSIT).length,
      inCustoms: shipments.filter(s => s.status === SHIPMENT_STATUS.IN_CUSTOMS).length,
      received: shipments.filter(s => s.status === SHIPMENT_STATUS.RECEIVED).length,
      distributed: shipments.filter(s => s.status === SHIPMENT_STATUS.DISTRIBUTED).length,
      totalGoodsValue: 0,
      totalCosts: 0,
      transportCosts: 0,
      customsCosts: 0,
      otherCosts: 0
    };

    shipments.forEach(shipment => {
      // Calculate goods value - backend returns total_price, not total
      const goodsValue = shipment.items?.reduce((sum, item) => {
        const itemTotal = item.total_price || item.total || (item.quantity * item.unit_price) || 0;
        return sum + itemTotal;
      }, 0) || 0;
      stats.totalGoodsValue += goodsValue;

      // Calculate costs
      const costs = calculateShipmentCosts(shipment);
      stats.totalCosts += costs.total;
      stats.transportCosts += costs.transport;
      stats.customsCosts += costs.customs;
      stats.otherCosts += costs.other;
    });

    return stats;
  };

  const stats = calculateStats();

  // Calculate distribution summary
  const calculateDistributionSummary = () => {
    const distributed = shipments.filter(s => s.status === SHIPMENT_STATUS.DISTRIBUTED);
    const summary = {
      totalDistributions: 0,
      b2bDistributions: 0,
      b2cDistributions: 0,
      totalRevenue: 0
    };

    distributed.forEach(shipment => {
      if (shipment.distribution) {
        summary.totalDistributions += shipment.distribution.length;
        shipment.distribution.forEach(dist => {
          if (dist.company_type === 'B2B') {
            summary.b2bDistributions++;
          } else {
            summary.b2cDistributions++;
          }
          summary.totalRevenue += dist.total_cost || 0;
        });
      }
    });

    return summary;
  };

  const distSummary = calculateDistributionSummary();

  // Status configuration for display
  const statusConfig = {
    [SHIPMENT_STATUS.ORDERED]: { label: 'Buyurtma berildi', color: 'bg-blue-500' },
    [SHIPMENT_STATUS.IN_TRANSIT]: { label: "Yo'lda", color: 'bg-orange-500' },
    [SHIPMENT_STATUS.IN_CUSTOMS]: { label: 'Bojxonada', color: 'bg-yellow-500' },
    [SHIPMENT_STATUS.RECEIVED]: { label: 'Qabul qilindi', color: 'bg-green-500' },
    [SHIPMENT_STATUS.DISTRIBUTED]: { label: 'Taqsimlandi', color: 'bg-purple-500' }
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Umumiy ko'rinish</SelectItem>
                  <SelectItem value="shipments">Yuklar ro'yxati</SelectItem>
                  <SelectItem value="costs">Xarajatlar tahlili</SelectItem>
                </SelectContent>
              </Select>

              {reportType === 'shipments' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha holatlar</SelectItem>
                    <SelectItem value={SHIPMENT_STATUS.ORDERED}>Buyurtma berildi</SelectItem>
                    <SelectItem value={SHIPMENT_STATUS.IN_TRANSIT}>Yo'lda</SelectItem>
                    <SelectItem value={SHIPMENT_STATUS.IN_CUSTOMS}>Bojxonada</SelectItem>
                    <SelectItem value={SHIPMENT_STATUS.RECEIVED}>Qabul qilindi</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Eksport qilish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overview Report */}
      {reportType === 'overview' && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Jami yuklar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.totalShipments}</div>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <Package className="w-3 h-3" />
                  Barcha yuklar
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Tovarlar qiymati</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  ${stats.totalGoodsValue.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <TrendingUp className="w-3 h-3" />
                  Jami tovarlar
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Jami xarajatlar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  ${stats.totalCosts.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                  <DollarSign className="w-3 h-3" />
                  Barcha xarajatlar
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Yuklar holati bo'yicha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Buyurtma</span>
                    <Badge className="bg-blue-500">{stats.ordered}</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${stats.totalShipments ? (stats.ordered / stats.totalShipments * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Yo'lda</span>
                    <Badge className="bg-orange-500">{stats.inTransit}</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ width: `${stats.totalShipments ? (stats.inTransit / stats.totalShipments * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Bojxonada</span>
                    <Badge className="bg-yellow-500">{stats.inCustoms}</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${stats.totalShipments ? (stats.inCustoms / stats.totalShipments * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Qabul qilindi</span>
                    <Badge className="bg-green-500">{stats.received}</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${stats.totalShipments ? (stats.received / stats.totalShipments * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Xarajatlar taqsimoti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Transport</div>
                  <div className="text-2xl font-bold text-slate-900">
                    ${stats.transportCosts.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.totalCosts ? ((stats.transportCosts / stats.totalCosts) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Bojxona</div>
                  <div className="text-2xl font-bold text-slate-900">
                    ${stats.customsCosts.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.totalCosts ? ((stats.customsCosts / stats.totalCosts) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Boshqa</div>
                  <div className="text-2xl font-bold text-slate-900">
                    ${stats.otherCosts.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.totalCosts ? ((stats.otherCosts / stats.totalCosts) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Shipments List Report */}
      {reportType === 'shipments' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Yuklar ro'yxati ({filteredShipments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredShipments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Yuklar topilmadi
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Yetkazib beruvchi</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Tovarlar</TableHead>
                    <TableHead className="text-right">Xarajatlar</TableHead>
                    <TableHead className="text-right">Jami</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => {
                    const costs = calculateShipmentCosts(shipment);
                    const goodsValue = shipment.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
                    const config = statusConfig[shipment.status];

                    return (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.tracking_number}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{shipment.supplier_company}</div>
                            <div className="text-slate-500">{shipment.supplier_country}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={config?.color}>{config?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">${goodsValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">${costs.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${(goodsValue + costs.total).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Costs Analysis Report */}
      {reportType === 'costs' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Xarajatlar tahlili
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shipments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Ma'lumot yo'q
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="text-right">Transport</TableHead>
                    <TableHead className="text-right">Bojxona</TableHead>
                    <TableHead className="text-right">Boshqa</TableHead>
                    <TableHead className="text-right">Jami xarajat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => {
                    const costs = calculateShipmentCosts(shipment);

                    return (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.tracking_number}</TableCell>
                        <TableCell className="text-right">${costs.transport.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${costs.customs.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${costs.other.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          ${costs.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
