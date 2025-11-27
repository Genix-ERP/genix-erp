import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  Plus, 
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Briefcase,
  Brain
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function HR() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insights, setInsights] = useState(null);

  const loadEmployees = useCallback(async () => {
    try {
      const Employee = await import('@/api/entities').then(m => m.Employee);
      const data = await Employee.list("-hire_date");
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  }, []);

  const generateInsights = useCallback(async () => {
    try {
      const Employee = await import('@/api/entities').then(m => m.Employee);
      const data = await Employee.list();
      const highTurnoverRiskCount = data.filter(e => e.turnover_risk === 'high').length;
      const avgPerformance = data.length > 0 ? data.reduce((sum, e) => sum + (e.performance_score || 0), 0) / data.length : 0;

      const insightsResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the HR AI of Genix. Analyze this workforce data and provide insights on retention, performance, and cost efficiency:
        - Total Employees: ${data.length}
        - High Turnover Risks: ${highTurnoverRiskCount}
        - Average Performance Score: ${avgPerformance.toFixed(2)}/5
        - Department breakdown: ${JSON.stringify(data.reduce((acc, e) => { acc[e.department] = (acc[e.department] || 0) + 1; return acc; }, {}))}
        
        Provide 3 actionable insights with clear recommendations.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      });
      setInsights(insightsResult.insights);
    } catch (error) {
      console.error("Error generating AI insights:", error);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    generateInsights();
  }, [loadEmployees, generateInsights]);

  useEffect(() => {
    let filtered = employees;
    if (searchQuery) {
      filtered = filtered.filter(e => e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || e.job_title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (departmentFilter !== "all") {
      filtered = filtered.filter(e => e.department === departmentFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    setFilteredEmployees(filtered);
  }, [employees, searchQuery, departmentFilter, statusFilter]);
  
  const metrics = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(e => e.status === 'active').length,
    highTurnoverRisk: employees.filter(e => e.turnover_risk === 'high').length,
    avgPerformance: (employees.length > 0 ? employees.reduce((sum, e) => sum + (e.performance_score || 3), 0) / employees.length : 0).toFixed(1)
  };

  const getRiskColor = (risk) => ({ low: "text-green-600", medium: "text-yellow-600", high: "text-red-600" }[risk] || "text-slate-600");

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[var(--genix-navy)]">{t('hr_title')}</h1>
            <p className="text-slate-600 mt-2">{t('hr_subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
            <Plus className="w-4 h-4 mr-2" />
            {t('add_employee')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><Users className="w-8 h-8 text-[var(--genix-blue)]" /><div><p className="text-2xl font-bold">{metrics.totalEmployees}</p><p className="text-sm text-slate-500">{t('total_employees')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><UserCheck className="w-8 h-8 text-green-600" /><div><p className="text-2xl font-bold">{metrics.activeEmployees}</p><p className="text-sm text-slate-500">{t('active_employees')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><UserX className="w-8 h-8 text-red-600" /><div><p className="text-2xl font-bold">{metrics.highTurnoverRisk}</p><p className="text-sm text-slate-500">{t('high_turnover_risk')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><TrendingUp className="w-8 h-8 text-purple-600" /><div><p className="text-2xl font-bold">{metrics.avgPerformance}/5</p><p className="text-sm text-slate-500">{t('avg_performance')}</p></div></div></CardContent></Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Input placeholder={t('search_employees_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('all_departments')}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_departments')}</SelectItem>
                  <SelectItem value="engineering">{t('engineering')}</SelectItem>
                  <SelectItem value="sales">{t('sales')}</SelectItem>
                  <SelectItem value="marketing">{t('marketing')}</SelectItem>
                  <SelectItem value="finance">{t('finance')}</SelectItem>
                  <SelectItem value="operations">{t('operations')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('all_statuses')}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_statuses')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="on_leave">{t('on_leave')}</SelectItem>
                  <SelectItem value="terminated">{t('terminated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Employee Directory */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader><CardTitle>{t('employee_directory_title')}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table_header_employee')}</TableHead>
                  <TableHead>{t('table_header_department')}</TableHead>
                  <TableHead>{t('table_header_hire_date')}</TableHead>
                  <TableHead>{t('table_header_performance')}</TableHead>
                  <TableHead>{t('table_header_turnover_risk')}</TableHead>
                  <TableHead>{t('table_header_status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{e.full_name}</p>
                        <p className="text-sm text-slate-500">{e.job_title}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t(e.department)}</Badge></TableCell>
                    <TableCell>{new Date(e.hire_date).toLocaleDateString()}</TableCell>
                    <TableCell>{e.performance_score}/5</TableCell>
                    <TableCell className={getRiskColor(e.turnover_risk)}>{t(e.turnover_risk)}</TableCell>
                    <TableCell><Badge>{t(e.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* AI HR Insights - Moved to bottom */}
        {insights && insights.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
              <h3 className="text-xl font-bold text-[var(--genix-navy)]">{t('ai_hr_insights')}</h3>
              <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">{t('ai_powered')}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {insights.map((insight, index) => (
                <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">{insight.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600">{insight.description}</p>
                    <div className="p-3 bg-[var(--genix-light-blue)]/30 rounded-lg">
                      <p className="text-sm font-medium text-[var(--genix-blue)]">
                        💡 {insight.recommendation}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}