import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const COLORS = { passed: '#10b981', failed: '#ef4444', pending: '#f59e0b', conditional_pass: '#f59e0b' };

export default function QualityControl() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const context = useManufacturing();

  // Extra safety: ensure we have valid context data
  const qualityChecks = context?.qualityChecks;
  const loading = context?.loading;

  // Ensure qualityChecks is always an array
  const checksArray = Array.isArray(qualityChecks) ? qualityChecks : [];

  const getResultColor = (result) => {
    const colors = {
      passed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      conditional_pass: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[result] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getResultIcon = (result) => {
    if (result === 'passed') return <CheckCircle className="w-4 h-4" />;
    if (result === 'failed') return <XCircle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const qualityStats = {
    total: checksArray.length,
    passed: checksArray.filter(q => q.result === 'passed').length,
    failed: checksArray.filter(q => q.result === 'failed').length,
    pending: checksArray.filter(q => q.result === 'pending').length
  };

  const chartData = [
    { name: 'passed', value: qualityStats.passed },
    { name: 'failed', value: qualityStats.failed },
    { name: 'pending', value: qualityStats.pending }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <PackageCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{qualityStats.total}</p>
            <p className="text-sm text-slate-600">{t('total_inspections') || 'Total Inspections'}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-green-900">{qualityStats.passed}</p>
            <p className="text-sm text-slate-600">{t('passed') || 'Passed'}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-900">{qualityStats.failed}</p>
            <p className="text-sm text-slate-600">{t('failed') || 'Failed'}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {qualityStats.total > 0 ? Math.round((qualityStats.passed / qualityStats.total) * 100) : 0}%
            </p>
            <p className="text-sm text-slate-600">{t('pass_rate') || 'Pass Rate'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quality Distribution Chart */}
        {chartData.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle>{t('quality_distribution') || 'Quality Distribution'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Inspections */}
        <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle>{t('recent_quality_inspections') || 'Recent Quality Inspections'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">{t('loading') || 'Loading'}...</p>
                </div>
              </div>
            ) : checksArray.length === 0 ? (
              <div className="text-center py-16">
                <PackageCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_quality_checks_recorded_yet') || 'No quality checks recorded yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('check_number') || 'Check #'}</TableHead>
                      <TableHead>{t('product') || 'Product'}</TableHead>
                      <TableHead>{t('type') || 'Type'}</TableHead>
                      <TableHead>{t('sample_size') || 'Sample Size'}</TableHead>
                      <TableHead>{t('result') || 'Result'}</TableHead>
                      <TableHead>{t('score') || 'Score'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checksArray.slice(0, 10).map((check) => (
                      <TableRow key={check.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-sm">{check.code}</TableCell>
                        <TableCell className="font-medium">{check.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{check.defect_category || check.defect_type || '-'}</Badge>
                        </TableCell>
                        <TableCell>{check.quantity_inspected || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getResultColor(check.result)}>
                            {getResultIcon(check.result)}
                            <span className="ml-1">{check.result}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{check.pass_rate != null ? `${check.pass_rate}%` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  );
}