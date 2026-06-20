import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Clock,
  ThumbsUp,
  Star,
  Search,
  Zap
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useProcurement } from '@/components/contexts/ProcurementContext';

export default function SupplierPerformance() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { suppliers: contextSuppliers, purchaseOrders } = useProcurement();

  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days

  // Calculate performance metrics for each supplier based on purchase orders
  const suppliers = useMemo(() => {
    return contextSuppliers.map(supplier => {
      // Get orders for this supplier
      const supplierOrders = purchaseOrders.filter(po =>
        po.supplier_id === supplier.id ||
        po.vendor_name?.toLowerCase() === supplier.name?.toLowerCase()
      );

      const totalOrders = supplierOrders.length;
      const receivedOrders = supplierOrders.filter(po => po.status === 'received');
      const onTimeDeliveries = receivedOrders.filter(po => {
        if (!po.expected_delivery_date || !po.received_date) return true; // Assume on-time if no dates
        return new Date(po.received_date) <= new Date(po.expected_delivery_date);
      }).length;

      const onTimeRate = totalOrders > 0 ? (onTimeDeliveries / Math.max(receivedOrders.length, 1)) * 100 : 100;
      const totalSpend = supplierOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);

      // Use supplier's existing rating (real data only)
      const rating = supplier.rating || supplier.overall_rating || null;

      return {
        id: supplier.id,
        vendor_name: supplier.name,
        rating: rating,
        on_time_rate: onTimeRate,
        on_time_deliveries: onTimeDeliveries,
        total_orders: totalOrders,
        total_spend: totalSpend,
        avg_lead_time: supplier.lead_time_days || supplier.avg_lead_time || null,
        issues: supplier.open_issues || 0,
        returns: supplier.returns_count || 0
      };
    });
  }, [contextSuppliers, purchaseOrders]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    let filtered = suppliers;

    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (performanceFilter !== 'all') {
      if (performanceFilter === 'excellent') {
        filtered = filtered.filter(s => s.on_time_rate >= 90);
      } else if (performanceFilter === 'good') {
        filtered = filtered.filter(s => s.on_time_rate >= 80 && s.on_time_rate < 90);
      } else if (performanceFilter === 'fair') {
        filtered = filtered.filter(s => s.on_time_rate >= 70 && s.on_time_rate < 80);
      } else if (performanceFilter === 'poor') {
        filtered = filtered.filter(s => s.on_time_rate < 70);
      }
    }

    return filtered;
  }, [suppliers, searchTerm, performanceFilter]);

  const getRatingStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />);
    }
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  // Calculate statistics
  const avgOnTimeRate = suppliers.length > 0
    ? suppliers.reduce((sum, s) => sum + s.on_time_rate, 0) / suppliers.length
    : 0;

  const totalSpendAll = suppliers.reduce((sum, s) => sum + s.total_spend, 0);
  const totalIssues = suppliers.reduce((sum, s) => sum + s.issues, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6" />
            {t('supplier_performance') || 'Supplier Performance'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('supplier_performance_desc') || 'Track and analyze supplier KPIs and performance metrics'}
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t('last_7_days') || 'Last 7 Days'}</SelectItem>
            <SelectItem value="30">{t('last_30_days') || 'Last 30 Days'}</SelectItem>
            <SelectItem value="90">{t('last_90_days') || 'Last 90 Days'}</SelectItem>
            <SelectItem value="365">{t('last_year') || 'Last Year'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              {t('suppliers') || 'Suppliers'}
            </CardDescription>
            <CardTitle className="text-3xl">{suppliers.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('on_time_delivery') || 'On-Time Delivery'}
            </CardDescription>
            <CardTitle className="text-3xl">{avgOnTimeRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {suppliers.reduce((sum, s) => sum + s.on_time_deliveries, 0)} / {suppliers.reduce((sum, s) => sum + s.total_orders, 0)} {t('orders') || 'orders'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t('total_spend') || 'Total Spend'}
            </CardDescription>
            <CardTitle className="text-3xl">{(totalSpendAll / 1000000).toFixed(1)}M</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {t('issues') || 'Issues'}
            </CardDescription>
            <CardTitle className="text-3xl">{totalIssues}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('search_suppliers') || 'Search suppliers...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_suppliers') || 'All Suppliers'}</SelectItem>
                <SelectItem value="excellent">{t('excellent') || 'Excellent (90+)'}</SelectItem>
                <SelectItem value="good">{t('good') || 'Good (80-89)'}</SelectItem>
                <SelectItem value="fair">{t('fair') || 'Fair (70-79)'}</SelectItem>
                <SelectItem value="poor">{t('poor') || 'Poor (<70)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('supplier') || 'Supplier'}</TableHead>
                  <TableHead className="text-center">{t('rating') || 'Rating'}</TableHead>
                  <TableHead className="text-center">{t('on_time') || 'On-Time'}</TableHead>
                  <TableHead className="text-right">{t('total_spend') || 'Total Spend'}</TableHead>
                  <TableHead className="text-center">{t('lead_time') || 'Lead Time'}</TableHead>
                  <TableHead className="text-center">{t('issues') || 'Issues'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.vendor_name}</TableCell>
                    <TableCell className="text-center">
                      {supplier.rating != null ? (
                        <div className="flex flex-col items-center gap-1">
                          {getRatingStars(supplier.rating)}
                          <span className="text-xs text-muted-foreground">{supplier.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-full bg-gray-200 rounded-full h-2 max-w-[80px]">
                          <div
                            className={`h-2 rounded-full ${supplier.on_time_rate >= 90 ? 'bg-green-600' : supplier.on_time_rate >= 80 ? 'bg-blue-600' : 'bg-orange-600'}`}
                            style={{ width: `${supplier.on_time_rate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs">{supplier.on_time_rate.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(supplier.total_spend / 1000000).toFixed(1)}M
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{supplier.avg_lead_time != null ? `${supplier.avg_lead_time} ${t('days') || 'days'}` : '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={supplier.issues > 5 ? 'destructive' : 'secondary'}>
                          {supplier.issues}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{supplier.returns} {t('returns') || 'returns'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t('action_items') || 'Action Items'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suppliers
              .filter(s => (s.total_orders > 0 && s.on_time_rate < 80) || s.issues > 5)
              .slice(0, 5)
              .map(supplier => (
                <div key={supplier.id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{supplier.vendor_name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {supplier.total_orders > 0 && supplier.on_time_rate < 80 && `${t('on_time_delivery') || 'On-time delivery'}: ${supplier.on_time_rate.toFixed(1)}%. `}
                      {supplier.issues > 5 && `${supplier.issues} ${t('open_issues') || 'open issues'}. `}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    {t('review') || 'Review'}
                  </Button>
                </div>
              ))}
            {suppliers.filter(s => (s.total_orders > 0 && s.on_time_rate < 80) || s.issues > 5).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ThumbsUp className="w-8 h-8 mx-auto mb-2" />
                <p>{t('no_action_items') || 'All suppliers performing well!'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
