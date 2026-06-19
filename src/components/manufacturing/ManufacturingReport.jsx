import React, { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, CheckCircle, XCircle, DollarSign, List, BarChart3 } from 'lucide-react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function ManufacturingReport() {
  const { language } = useLanguage();
  const { productionOrders, manufacturingCategories } = useManufacturing();
  const { formatCurrency } = useCurrencyFormatter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('byProduct'); // 'byOrder' or 'byProduct'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const l = {
    en: { title: 'Manufacturing Report', subtitle: 'Production orders overview by category', all: 'All', order_code: 'Order Code', product: 'Product', qty_planned: 'Planned', qty_produced: 'Produced', good_qty: 'Good', reject_qty: 'Reject', loss: 'Loss', status: 'Status', shortfall_reason: 'Shortfall Reason', total_produced: 'Total Produced', total_good: 'Total Good', total_reject: 'Total Reject', total_loss: 'Total Loss', no_orders: 'No production orders found', uncategorized: 'Uncategorized', by_order: 'By Order', by_product: 'By Product', orders_count: 'Orders', efficiency: 'Efficiency', unit_cost: 'Cost/Unit' },
    uz: { title: 'Ishlab chiqarish hisoboti', subtitle: 'Kategoriya bo\'yicha ishlab chiqarish buyurtmalari', all: 'Barchasi', order_code: 'Buyurtma kodi', product: 'Mahsulot', qty_planned: 'Rejalashtirilgan', qty_produced: 'Ishlab chiqarilgan', good_qty: 'Yaxshi', reject_qty: 'Yaroqsiz', loss: 'Zarar', status: 'Holat', shortfall_reason: 'Kamomad sababi', total_produced: 'Jami ishlab chiqarilgan', total_good: 'Jami yaxshi', total_reject: 'Jami yaroqsiz', total_loss: 'Jami zarar', no_orders: 'Ishlab chiqarish buyurtmalari topilmadi', uncategorized: 'Kategoriyasiz', by_order: 'Buyurtma bo\'yicha', by_product: 'Mahsulot bo\'yicha', orders_count: 'Buyurtmalar', efficiency: 'Samaradorlik', unit_cost: 'Narx/birlik' },
    ru: { title: 'Отчёт производства', subtitle: 'Обзор производственных заказов по категориям', all: 'Все', order_code: 'Код заказа', product: 'Продукт', qty_planned: 'План', qty_produced: 'Произведено', good_qty: 'Годные', reject_qty: 'Брак', loss: 'Убыток', status: 'Статус', shortfall_reason: 'Причина недостачи', total_produced: 'Всего произведено', total_good: 'Всего годных', total_reject: 'Всего брак', total_loss: 'Всего убыток', no_orders: 'Производственные заказы не найдены', uncategorized: 'Без категории', by_order: 'По заказам', by_product: 'По продуктам', orders_count: 'Заказов', efficiency: 'Эффективность', unit_cost: 'Цена/ед.' },
  }[language] || { title: 'Manufacturing Report', subtitle: 'Production orders overview by category', all: 'All', order_code: 'Order Code', product: 'Product', qty_planned: 'Planned', qty_produced: 'Produced', good_qty: 'Good', reject_qty: 'Reject', loss: 'Loss', status: 'Status', shortfall_reason: 'Shortfall Reason', total_produced: 'Total Produced', total_good: 'Total Good', total_reject: 'Total Reject', total_loss: 'Total Loss', no_orders: 'No production orders found', uncategorized: 'Uncategorized' };

  const calcLoss = (order) => {
    const reject = order.reject_quantity || 0;
    if (reject <= 0) return 0;
    const produced = order.quantity_produced || 0;
    const total = produced + reject;
    if (total > 0 && order.actual_cost > 0) {
      return reject * (order.actual_cost / total);
    }
    const planned = order.quantity_planned || 1;
    if (order.material_cost > 0) {
      return reject * (order.material_cost / planned);
    }
    return 0;
  };

  const filteredOrders = useMemo(() => {
    let orders = (productionOrders || []).filter(po => po.status !== 'cancelled');
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') orders = orders.filter(po => !po.manufacturing_category_id);
      else orders = orders.filter(po => po.manufacturing_category_id === selectedCategory);
    }
    if (dateFrom) {
      orders = orders.filter(po => po.created_at && po.created_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      orders = orders.filter(po => po.created_at && po.created_at.slice(0, 10) <= dateTo);
    }
    return orders;
  }, [productionOrders, selectedCategory, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let totalProduced = 0, totalGood = 0, totalReject = 0, totalLoss = 0;
    filteredOrders.forEach(po => {
      totalProduced += po.quantity_produced || 0;
      totalGood += po.good_quantity || 0;
      totalReject += po.reject_quantity || 0;
      totalLoss += calcLoss(po);
    });
    return { totalProduced, totalGood, totalReject, totalLoss };
  }, [filteredOrders]);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    paused: 'bg-orange-100 text-orange-700',
  };

  const statusLabels = {
    en: { draft: 'Draft', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', paused: 'Paused', cancelled: 'Cancelled' },
    uz: { draft: 'Qoralama', confirmed: 'Tasdiqlangan', in_progress: 'Jarayonda', completed: 'Tugallangan', paused: 'To\'xtatilgan', cancelled: 'Bekor qilingan' },
    ru: { draft: 'Черновик', confirmed: 'Подтверждён', in_progress: 'В процессе', completed: 'Завершён', paused: 'Приостановлен', cancelled: 'Отменён' },
  }[language] || { draft: 'Draft', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', paused: 'Paused', cancelled: 'Cancelled' };

  const activeCategories = (manufacturingCategories || []).filter(c => c.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{l.title}</h2>
        <p className="text-slate-600 mt-1">{l.subtitle}</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'bg-slate-800 text-white' : ''}
        >
          {l.all}
        </Button>
        {activeCategories.map(cat => (
          <Button
            key={cat.id}
            size="sm"
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(cat.id)}
            className={selectedCategory === cat.id ? 'bg-slate-800 text-white' : ''}
          >
            {cat.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant={selectedCategory === 'uncategorized' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('uncategorized')}
          className={selectedCategory === 'uncategorized' ? 'bg-slate-800 text-white' : ''}
        >
          {l.uncategorized}
        </Button>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">{language === 'uz' ? 'Dan' : language === 'ru' ? 'С' : 'From'}:</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">{language === 'uz' ? 'Gacha' : language === 'ru' ? 'По' : 'To'}:</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
        </div>
        {(dateFrom || dateTo) && (
          <Button size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-slate-500">
            ✕ {language === 'uz' ? 'Tozalash' : language === 'ru' ? 'Сбросить' : 'Clear'}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{summary.totalProduced.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{l.total_produced}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{summary.totalGood.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{l.total_good}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{summary.totalReject.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{l.total_reject}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalLoss)}</p>
                <p className="text-xs text-slate-500">{l.total_loss}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={viewMode === 'byProduct' ? 'default' : 'outline'}
          onClick={() => setViewMode('byProduct')}
          className={viewMode === 'byProduct' ? 'bg-indigo-600 text-white' : ''}
        >
          <BarChart3 className="w-4 h-4 mr-1" />
          {l.by_product}
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'byOrder' ? 'default' : 'outline'}
          onClick={() => setViewMode('byOrder')}
          className={viewMode === 'byOrder' ? 'bg-indigo-600 text-white' : ''}
        >
          <List className="w-4 h-4 mr-1" />
          {l.by_order}
        </Button>
      </div>

      {/* By Product View */}
      {viewMode === 'byProduct' && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-slate-500">{l.no_orders}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>{l.product}</TableHead>
                    <TableHead className="text-right">{l.orders_count}</TableHead>
                    <TableHead className="text-right">{l.qty_planned}</TableHead>
                    <TableHead className="text-right">{l.qty_produced}</TableHead>
                    <TableHead className="text-right">{l.good_qty}</TableHead>
                    <TableHead className="text-right">{l.reject_qty}</TableHead>
                    <TableHead className="text-right">{l.efficiency}</TableHead>
                    <TableHead className="text-right">{l.unit_cost || 'Narx/birlik'}</TableHead>
                    <TableHead className="text-right">{l.loss}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const grouped = {};
                    filteredOrders.forEach(po => {
                      const key = po.product_id || po.product_name;
                      if (!grouped[key]) {
                        grouped[key] = { name: po.product_name, uom: po.uom || '', orders: 0, planned: 0, produced: 0, good: 0, reject: 0, loss: 0, cost: 0 };
                      }
                      if (!grouped[key].uom && po.uom) grouped[key].uom = po.uom;
                      grouped[key].orders += 1;
                      grouped[key].planned += po.quantity_planned || 0;
                      grouped[key].produced += po.quantity_produced || 0;
                      grouped[key].good += po.good_quantity || 0;
                      grouped[key].reject += po.reject_quantity || 0;
                      grouped[key].loss += calcLoss(po);
                      // Production cost per order (actual → planned → material fallback) for unit-cost rollup.
                      grouped[key].cost += (po.actual_cost || po.planned_cost || po.material_cost || 0);
                    });
                    return Object.entries(grouped)
                      .sort((a, b) => b[1].produced - a[1].produced)
                      .map(([key, data]) => {
                        const efficiency = data.produced > 0 ? ((data.good / data.produced) * 100).toFixed(1) : 0;
                        // Production cost per unit = total cost ÷ quantity (produced, else planned), shown per UOM.
                        const qtyForCost = data.produced > 0 ? data.produced : data.planned;
                        const unitCost = qtyForCost > 0 ? data.cost / qtyForCost : 0;
                        return (
                          <TableRow key={key} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium">{data.name}</TableCell>
                            <TableCell className="text-right">{data.orders}</TableCell>
                            <TableCell className="text-right">{data.planned}</TableCell>
                            <TableCell className="text-right font-medium">{data.produced}</TableCell>
                            <TableCell className="text-right text-green-700 font-medium">{data.good}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{data.reject}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${parseFloat(efficiency) >= 90 ? 'text-green-600' : parseFloat(efficiency) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                {efficiency}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{unitCost > 0 ? `${formatCurrency(unitCost)}${data.uom ? ' / ' + data.uom : ''}` : '—'}</TableCell>
                            <TableCell className="text-right text-amber-700 font-medium">{data.loss > 0 ? formatCurrency(data.loss) : '—'}</TableCell>
                          </TableRow>
                        );
                      });
                  })()}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* By Order View */}
      {viewMode === 'byOrder' && (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-500">{l.no_orders}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>{l.order_code}</TableHead>
                  <TableHead>{l.product}</TableHead>
                  <TableHead className="text-right">{l.qty_planned}</TableHead>
                  <TableHead className="text-right">{l.qty_produced}</TableHead>
                  <TableHead className="text-right">{l.good_qty}</TableHead>
                  <TableHead className="text-right">{l.reject_qty}</TableHead>
                  <TableHead className="text-right">{l.loss}</TableHead>
                  <TableHead>{l.shortfall_reason}</TableHead>
                  <TableHead>{l.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map(po => {
                  const loss = calcLoss(po);
                  return (
                    <TableRow key={po.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{po.code}</TableCell>
                      <TableCell>{po.product_name}</TableCell>
                      <TableCell className="text-right">{po.quantity_planned}</TableCell>
                      <TableCell className="text-right">{po.quantity_produced}</TableCell>
                      <TableCell className="text-right text-green-700 font-medium">{po.good_quantity || 0}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{po.reject_quantity || 0}</TableCell>
                      <TableCell className="text-right text-amber-700 font-medium">{loss > 0 ? formatCurrency(loss) : '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[200px] truncate" title={po.shortfall_reason || ''}>
                        {po.shortfall_reason || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[po.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[po.status] || po.status}
                        </Badge>
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
