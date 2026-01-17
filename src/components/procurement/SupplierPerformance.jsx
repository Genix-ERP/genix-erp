import React, { useState, useEffect } from 'react';
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
  TrendingDown,
  Award,
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  ThumbsUp,
  Star,
  Search,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function SupplierPerformance() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days

  // Load supplier performance data
  useEffect(() => {
    // Sample performance data
    const performanceData = [
      {
        id: '1',
        vendor_name: 'Tech Supplies Ltd',
        total_orders: 45,
        on_time_deliveries: 42,
        on_time_rate: 93.3,
        quality_score: 95,
        defect_rate: 2.1,
        total_spend: 125000000,
        avg_lead_time: 5.2,
        price_competitiveness: 88,
        response_time: 1.5,
        performance_score: 92,
        rating: 4.6,
        trend: 'up',
        issues: 3,
        returns: 2
      },
      {
        id: '2',
        vendor_name: 'Office Equipment Co',
        total_orders: 38,
        on_time_deliveries: 35,
        on_time_rate: 92.1,
        quality_score: 91,
        defect_rate: 3.5,
        total_spend: 95000000,
        avg_lead_time: 6.8,
        price_competitiveness: 85,
        response_time: 2.1,
        performance_score: 89,
        rating: 4.4,
        trend: 'up',
        issues: 4,
        returns: 3
      },
      {
        id: '3',
        vendor_name: 'Industrial Parts Inc',
        total_orders: 52,
        on_time_deliveries: 46,
        on_time_rate: 88.5,
        quality_score: 87,
        defect_rate: 5.2,
        total_spend: 180000000,
        avg_lead_time: 8.3,
        price_competitiveness: 82,
        response_time: 2.8,
        performance_score: 85,
        rating: 4.1,
        trend: 'down',
        issues: 8,
        returns: 6
      },
      {
        id: '4',
        vendor_name: 'Quality Materials Ltd',
        total_orders: 29,
        on_time_deliveries: 28,
        on_time_rate: 96.6,
        quality_score: 98,
        defect_rate: 0.8,
        total_spend: 67000000,
        avg_lead_time: 4.1,
        price_competitiveness: 79,
        response_time: 1.2,
        performance_score: 94,
        rating: 4.8,
        trend: 'up',
        issues: 1,
        returns: 0
      },
      {
        id: '5',
        vendor_name: 'Budget Supplies Co',
        total_orders: 31,
        on_time_deliveries: 25,
        on_time_rate: 80.6,
        quality_score: 78,
        defect_rate: 8.5,
        total_spend: 52000000,
        avg_lead_time: 10.2,
        price_competitiveness: 95,
        response_time: 3.5,
        performance_score: 75,
        rating: 3.8,
        trend: 'down',
        issues: 12,
        returns: 9
      }
    ];

    setSuppliers(performanceData);
    setFilteredSuppliers(performanceData);
  }, []);

  // Filter suppliers
  useEffect(() => {
    let filtered = suppliers;

    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (performanceFilter !== 'all') {
      if (performanceFilter === 'excellent') {
        filtered = filtered.filter(s => s.performance_score >= 90);
      } else if (performanceFilter === 'good') {
        filtered = filtered.filter(s => s.performance_score >= 80 && s.performance_score < 90);
      } else if (performanceFilter === 'fair') {
        filtered = filtered.filter(s => s.performance_score >= 70 && s.performance_score < 80);
      } else if (performanceFilter === 'poor') {
        filtered = filtered.filter(s => s.performance_score < 70);
      }
    }

    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm, performanceFilter]);

  const getPerformanceBadge = (score) => {
    if (score >= 90) {
      return <Badge className="bg-green-600">Excellent</Badge>;
    } else if (score >= 80) {
      return <Badge className="bg-blue-600">Good</Badge>;
    } else if (score >= 70) {
      return <Badge className="bg-yellow-600">Fair</Badge>;
    } else {
      return <Badge variant="destructive">Poor</Badge>;
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    }
  };

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
  const avgPerformanceScore = suppliers.length > 0
    ? suppliers.reduce((sum, s) => sum + s.performance_score, 0) / suppliers.length
    : 0;

  const avgOnTimeRate = suppliers.length > 0
    ? suppliers.reduce((sum, s) => sum + s.on_time_rate, 0) / suppliers.length
    : 0;

  const avgQualityScore = suppliers.length > 0
    ? suppliers.reduce((sum, s) => sum + s.quality_score, 0) / suppliers.length
    : 0;

  const topPerformers = suppliers.filter(s => s.performance_score >= 90).length;
  const needsImprovement = suppliers.filter(s => s.performance_score < 80).length;

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
              <Target className="w-4 h-4" />
              {t('avg_performance_score') || 'Avg Performance'}
            </CardDescription>
            <CardTitle className="text-3xl">{avgPerformanceScore.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.3% {t('vs_last_month') || 'vs last month'}
            </div>
          </CardContent>
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
              <ThumbsUp className="w-4 h-4" />
              {t('quality_score') || 'Quality Score'}
            </CardDescription>
            <CardTitle className="text-3xl">{avgQualityScore.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {suppliers.reduce((sum, s) => sum + s.defect_rate, 0).toFixed(1) / suppliers.length}% {t('avg_defect_rate') || 'avg defect rate'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              {t('top_performers') || 'Top Performers'}
            </CardDescription>
            <CardTitle className="text-3xl">{topPerformers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-orange-600">
              {needsImprovement} {t('need_improvement') || 'need improvement'}
            </div>
          </CardContent>
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
                  <TableHead className="text-center">{t('performance') || 'Performance'}</TableHead>
                  <TableHead className="text-center">{t('on_time') || 'On-Time'}</TableHead>
                  <TableHead className="text-center">{t('quality') || 'Quality'}</TableHead>
                  <TableHead className="text-right">{t('total_spend') || 'Total Spend'}</TableHead>
                  <TableHead className="text-center">{t('lead_time') || 'Lead Time'}</TableHead>
                  <TableHead className="text-center">{t('issues') || 'Issues'}</TableHead>
                  <TableHead className="text-center">{t('trend') || 'Trend'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.vendor_name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getRatingStars(supplier.rating)}
                        <span className="text-xs text-muted-foreground">{supplier.rating.toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getPerformanceBadge(supplier.performance_score)}
                        <span className="text-sm font-semibold">{supplier.performance_score}%</span>
                      </div>
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
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold">{supplier.quality_score}%</span>
                        <span className="text-xs text-red-600">{supplier.defect_rate}% {t('defects') || 'defects'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(supplier.total_spend / 1000000).toFixed(1)}M
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{supplier.avg_lead_time} {t('days') || 'days'}</span>
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
                    <TableCell className="text-center">
                      {getTrendIcon(supplier.trend)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t('performance_distribution') || 'Performance Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">{t('excellent') || 'Excellent'} (90+)</span>
                  <span className="text-sm font-semibold">{suppliers.filter(s => s.performance_score >= 90).length} {t('suppliers') || 'suppliers'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full"
                    style={{ width: `${(suppliers.filter(s => s.performance_score >= 90).length / suppliers.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">{t('good') || 'Good'} (80-89)</span>
                  <span className="text-sm font-semibold">{suppliers.filter(s => s.performance_score >= 80 && s.performance_score < 90).length} {t('suppliers') || 'suppliers'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${(suppliers.filter(s => s.performance_score >= 80 && s.performance_score < 90).length / suppliers.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">{t('fair') || 'Fair'} (70-79)</span>
                  <span className="text-sm font-semibold">{suppliers.filter(s => s.performance_score >= 70 && s.performance_score < 80).length} {t('suppliers') || 'suppliers'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-600 h-3 rounded-full"
                    style={{ width: `${(suppliers.filter(s => s.performance_score >= 70 && s.performance_score < 80).length / suppliers.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">{t('poor') || 'Poor'} (&lt;70)</span>
                  <span className="text-sm font-semibold">{suppliers.filter(s => s.performance_score < 70).length} {t('suppliers') || 'suppliers'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{ width: `${(suppliers.filter(s => s.performance_score < 70).length / suppliers.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                .filter(s => s.performance_score < 80 || s.issues > 5)
                .slice(0, 5)
                .map(supplier => (
                  <div key={supplier.id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{supplier.vendor_name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {supplier.performance_score < 80 && `Performance: ${supplier.performance_score}%. `}
                        {supplier.issues > 5 && `${supplier.issues} open issues. `}
                        {supplier.defect_rate > 5 && `High defect rate: ${supplier.defect_rate}%.`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      {t('review') || 'Review'}
                    </Button>
                  </div>
                ))}
              {suppliers.filter(s => s.performance_score < 80 || s.issues > 5).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ThumbsUp className="w-8 h-8 mx-auto mb-2" />
                  <p>{t('no_action_items') || 'All suppliers performing well!'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
