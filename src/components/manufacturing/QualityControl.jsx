import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';

const COLORS = { pass: '#10b981', fail: '#ef4444', conditional_pass: '#f59e0b' };

export default function QualityControl() {
  const { qualityChecks, loading } = useManufacturing();

  const getResultColor = (result) => {
    const colors = {
      pass: 'bg-green-100 text-green-800 border-green-200',
      fail: 'bg-red-100 text-red-800 border-red-200',
      conditional_pass: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[result] || colors.pass;
  };

  const getResultIcon = (result) => {
    if (result === 'pass') return <CheckCircle className="w-4 h-4" />;
    if (result === 'fail') return <XCircle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const qualityStats = {
    total: qualityChecks.length,
    passed: qualityChecks.filter(q => q.result === 'pass').length,
    failed: qualityChecks.filter(q => q.result === 'fail').length,
    conditional: qualityChecks.filter(q => q.result === 'conditional_pass').length
  };

  const chartData = [
    { name: 'Passed', value: qualityStats.passed },
    { name: 'Failed', value: qualityStats.failed },
    { name: 'Conditional', value: qualityStats.conditional }
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
            <p className="text-sm text-slate-600">Total Inspections</p>
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
            <p className="text-sm text-slate-600">Passed</p>
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
            <p className="text-sm text-slate-600">Failed</p>
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
            <p className="text-sm text-slate-600">Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quality Distribution Chart */}
        {chartData.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle>Quality Distribution</CardTitle>
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
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase()] || '#64748b'} />
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
            <CardTitle>Recent Quality Inspections</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading quality checks...</p>
                </div>
              </div>
            ) : qualityChecks.length === 0 ? (
              <div className="text-center py-16">
                <PackageCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No quality checks recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Check #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sample Size</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityChecks.slice(0, 10).map((check) => (
                      <TableRow key={check.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-sm">{check.check_number}</TableCell>
                        <TableCell className="font-medium">{check.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{check.check_type}</Badge>
                        </TableCell>
                        <TableCell>{check.sample_size || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getResultColor(check.result)}>
                            {getResultIcon(check.result)}
                            <span className="ml-1">{check.result}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{check.quality_score || '-'}/100</TableCell>
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