import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, DollarSign, Users, Calculator, TrendingUp, Brain, Download, AlertTriangle, CheckCircle, Target, Lightbulb, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzePayroll } from '@/api/services/aiAnalytics';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

export default function Payroll() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { payrolls, employees, createPayroll, updatePayroll, isLoading } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  // AI Analysis
  const payrollAnalysis = useMemo(() => analyzePayroll(payrolls, employees, language), [payrolls, employees, language]);
  const [filteredPayrolls, setFilteredPayrolls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPayroll, setEditPayroll] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState(null);

  const [newPayroll, setNewPayroll] = useState({
    payroll_number: '',
    employee_id: '',
    employee_name: '',
    pay_period_start: '',
    pay_period_end: '',
    payment_date: '',
    basic_salary: 0,
    overtime_hours: 0,
    bonuses: 0,
    allowances: 0
  });

  useEffect(() => {
    let filtered = payrolls;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Apply employee filter OR search (search takes precedence)
    if (searchQuery) {
      // If user is searching, ignore employee filter
      filtered = filtered.filter(p =>
        p.payroll_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else if (employeeFilter !== 'all') {
      // Only apply employee filter if not searching
      filtered = filtered.filter(p => p.employee_name === employeeFilter);
    }

    setFilteredPayrolls(filtered);
  }, [payrolls, searchQuery, statusFilter, employeeFilter]);

  const calculatePayroll = (data) => {
    const basicSalary = parseFloat(data.basic_salary) || 0;
    const overtimeHours = parseFloat(data.overtime_hours) || 0;
    const overtimePay = overtimeHours * (basicSalary / 160);
    const bonuses = parseFloat(data.bonuses) || 0;
    const allowances = parseFloat(data.allowances) || 0;

    const grossPay = basicSalary + overtimePay + bonuses + allowances;

    const taxableAmount = Math.max(0, grossPay - 3000);
    const taxDeduction = taxableAmount * 0.20;

    const socialSecurity = grossPay * 0.062;
    const healthInsurance = 200;
    const otherDeductions = 0;

    const totalDeductions = taxDeduction + socialSecurity + healthInsurance + otherDeductions;
    const netPay = grossPay - totalDeductions;

    return {
      overtime_pay: overtimePay,
      gross_pay: grossPay,
      tax_deduction: taxDeduction,
      social_security: socialSecurity,
      health_insurance: healthInsurance,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_pay: netPay
    };
  };

  const handleCreatePayroll = () => {
    const calculated = calculatePayroll(newPayroll);

    const payrollData = {
      ...newPayroll,
      payroll_number: newPayroll.payroll_number || `PAY-${Date.now()}`,
      basic_salary: parseFloat(newPayroll.basic_salary),
      overtime_hours: parseFloat(newPayroll.overtime_hours),
      bonuses: parseFloat(newPayroll.bonuses),
      allowances: parseFloat(newPayroll.allowances),
      ...calculated,
      status: 'calculated',
      payment_method: 'bank_transfer'
    };

    createPayroll(payrollData);
    setShowCreateModal(false);

    setNewPayroll({
      payroll_number: '',
      employee_id: '',
      employee_name: '',
      pay_period_start: '',
      pay_period_end: '',
      payment_date: '',
      basic_salary: 0,
      overtime_hours: 0,
      bonuses: 0,
      allowances: 0
    });
  };

  const updatePayrollStatus = (payrollId, newStatus) => {
    updatePayroll(payrollId, { status: newStatus });
  };

  const handleEditPayroll = (payroll) => {
    setEditPayroll({
      ...payroll,
      basic_salary: payroll.basic_salary || 0,
      overtime_hours: payroll.overtime_hours || 0,
      bonuses: payroll.bonuses || 0,
      allowances: payroll.allowances || 0
    });
    setShowEditModal(true);
  };

  const handleUpdatePayroll = () => {
    if (!editPayroll) return;

    const calculated = calculatePayroll(editPayroll);

    updatePayroll(editPayroll.id, {
      employee_name: editPayroll.employee_name,
      pay_period_start: editPayroll.pay_period_start,
      pay_period_end: editPayroll.pay_period_end,
      payment_date: editPayroll.payment_date,
      basic_salary: parseFloat(editPayroll.basic_salary),
      overtime_hours: parseFloat(editPayroll.overtime_hours),
      bonuses: parseFloat(editPayroll.bonuses),
      allowances: parseFloat(editPayroll.allowances),
      ...calculated,
      status: editPayroll.status
    });

    setShowEditModal(false);
    setEditPayroll(null);
  };

  const handleDeleteClick = (payroll) => {
    setPayrollToDelete(payroll);
    setShowDeleteDialog(true);
  };

  const handleDeletePayroll = () => {
    if (payrollToDelete) {
      // Update status to 'cancelled' instead of actually deleting
      updatePayroll(payrollToDelete.id, { status: 'cancelled' });
      setShowDeleteDialog(false);
      setPayrollToDelete(null);
    }
  };

  const handleRecommendationClick = (recommendation) => {
    // Generate proper prompt based on recommendation type and language
    let prompt = '';

    if (recommendation.action.includes('Tax Compliance') || recommendation.action.includes('Soliq muvofiqligini') || recommendation.action.includes('налогового соответствия')) {
      // Tax compliance review prompt
      if (language === 'uz') {
        prompt = 'Ish haqi soliqlarini tekshirishda menga yordam bering. Barcha soliq ushlab qolinmalari to\'g\'ri ekanligiga qanday ishonch hosil qilishim mumkin?';
      } else if (language === 'ru') {
        prompt = 'Помогите мне проверить налоги на зарплату. Как я могу убедиться, что все налоговые удержания правильные?';
      } else {
        prompt = 'Help me review payroll taxes. How can I ensure all tax withholdings are accurate?';
      }
    } else if (recommendation.action.includes('Process') || recommendation.action.includes('qayta ishlash') || recommendation.action.includes('Обработка')) {
      // Process pending payroll prompt
      const pending = payrolls.filter(p => p.status === 'approved').length;
      if (language === 'uz') {
        prompt = `Menda ${pending} ta kutilayotgan ish haqi yozuvi bor. Ularni qanday qayta ishlashim kerak?`;
      } else if (language === 'ru') {
        prompt = `У меня ${pending} записей о зарплате в ожидании. Как мне их обработать?`;
      } else {
        prompt = `I have ${pending} pending payroll records. How should I process them?`;
      }
    } else {
      // Generic prompt
      prompt = recommendation.action;
    }

    // Open AI chatbox with the prompt
    if (window.openAIChat) {
      window.openAIChat(prompt);
    }
  };

  const handleDownloadPayslip = (payroll) => {
    // Format dates properly
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      try {
        return format(new Date(dateStr), 'MMM dd, yyyy');
      } catch {
        return dateStr;
      }
    };

    // Generate CSV payslip content
    const csvContent = [
      ['PAYROLL SLIP'],
      [''],
      ['Payroll Number', payroll.payroll_number],
      ['Employee', payroll.employee_name],
      ['Pay Period Start', formatDate(payroll.pay_period_start)],
      ['Pay Period End', formatDate(payroll.pay_period_end)],
      ['Payment Date', formatDate(payroll.payment_date)],
      [''],
      ['EARNINGS'],
      ['Basic Salary', (payroll.basic_salary || 0).toFixed(2)],
      ['Overtime Pay', (payroll.overtime_pay || 0).toFixed(2)],
      ['Bonuses', (payroll.bonuses || 0).toFixed(2)],
      ['Allowances', (payroll.allowances || 0).toFixed(2)],
      ['GROSS PAY', (payroll.gross_pay || 0).toFixed(2)],
      [''],
      ['DEDUCTIONS'],
      ['Tax', (payroll.tax_deduction || 0).toFixed(2)],
      ['Social Security', (payroll.social_security || 0).toFixed(2)],
      ['Health Insurance', (payroll.health_insurance || 0).toFixed(2)],
      ['Other Deductions', (payroll.other_deductions || 0).toFixed(2)],
      ['TOTAL DEDUCTIONS', (payroll.total_deductions || 0).toFixed(2)],
      [''],
      ['NET PAY', (payroll.net_pay || 0).toFixed(2)],
      [''],
      ['Status', payroll.status?.toUpperCase() || 'N/A'],
      ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')]
    ].map(row => row.join(',')).join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payslip_${payroll.payroll_number}_${payroll.employee_name?.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      calculated: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-slate-100 text-slate-800'
    };
    return colors[status] || colors.draft;
  };

  const metrics = {
    totalPayrolls: payrolls.length,
    totalGrossPay: payrolls.reduce((sum, p) => sum + (p.gross_pay || 0), 0),
    totalNetPay: payrolls.reduce((sum, p) => sum + (p.net_pay || 0), 0),
    pendingPayments: payrolls.filter(p => p.status === 'approved').length
  };

  const monthlyData = {};
  payrolls.forEach(p => {
    const month = p.pay_period_end ? format(new Date(p.pay_period_end), 'MM.yy') : t('unknown');
    monthlyData[month] = (monthlyData[month] || 0) + (p.net_pay || 0);
  });
  const chartData = Object.entries(monthlyData).slice(-6).map(([month, amount]) => ({ month, amount }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_payrolls')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalPayrolls}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('gross_pay')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalGrossPay)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('net_pay')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalNetPay)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('pending_payments')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.pendingPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(payrollAnalysis.insights.length > 0 || payrollAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-purple-600" />
                {t('ai_payroll_insights')}
                <Badge className="bg-purple-100 text-purple-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {payrollAnalysis.insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-purple-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {payrollAnalysis.recommendations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {payrollAnalysis.recommendations.map((rec, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecommendationClick(rec)}
                      className="flex items-center gap-2 text-xs bg-white rounded-full px-3 py-1.5 border border-purple-100 hover:bg-purple-50 hover:border-purple-300 transition-colors cursor-pointer"
                      title={t('ask_ai_about_this')}
                    >
                      <Lightbulb className="w-3 h-3 text-yellow-500" />
                      <span className="text-slate-700">{rec.action}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payroll Trend */}
        {chartData.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('monthly_payroll')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => [formatCurrency(value), t('amount')]} />
                  <Bar dataKey="amount" name={t('amount')} fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Payroll Table */}
        <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t('payroll_records')}</CardTitle>
                {canCreate(MODULES.PAYROLL) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                    <Plus className="w-4 h-4 mr-2" /> {t('process_payroll')}
                  </Button>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_payrolls')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
{/* Employee filter removed - showing payroll periods, not individual entries */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="draft">{t('draft')}</SelectItem>
                    <SelectItem value="calculated">{t('calculated')}</SelectItem>
                    <SelectItem value="approved">{t('approved')}</SelectItem>
                    <SelectItem value="paid">{t('paid')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredPayrolls.length === 0 ? (
                <div className="text-center py-16">
                  <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_payroll_records_yet')}</p>
                  {canCreate(MODULES.PAYROLL) && (
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('process_first_payroll')}</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('payroll_number')}</TableHead>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('period')}</TableHead>
                        <TableHead>{t('gross_pay')}</TableHead>
                        <TableHead>{t('net_pay')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayrolls.map((payroll) => (
                        <TableRow key={payroll.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{payroll.payroll_number}</TableCell>
                          <TableCell className="font-medium">{payroll.employee_name || payroll.period_name}</TableCell>
                          <TableCell className="text-sm">
                            {payroll.pay_period_start && payroll.pay_period_end ?
                              `${format(new Date(payroll.pay_period_start), 'dd.MM')} - ${format(new Date(payroll.pay_period_end), 'dd.MM')}`
                              : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(payroll.gross_pay || 0)}</TableCell>
                          <TableCell className="font-semibold text-green-600">{formatCurrency(payroll.net_pay || 0)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(payroll.status)}>{t(payroll.status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {payroll.status === 'draft' && canUpdate(MODULES.PAYROLL) && (
                                <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => updatePayrollStatus(payroll.id, 'approved')}>
                                  {t('approve')}
                                </Button>
                              )}
                              {payroll.status === 'calculated' && canUpdate(MODULES.PAYROLL) && (
                                <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => updatePayrollStatus(payroll.id, 'approved')}>
                                  {t('approve')}
                                </Button>
                              )}
                              {payroll.status === 'approved' && canUpdate(MODULES.PAYROLL) && (
                                <Button size="sm" variant="ghost" className="text-green-600" onClick={() => updatePayrollStatus(payroll.id, 'paid')}>
                                  {t('pay')}
                                </Button>
                              )}
                              {(payroll.status === 'draft' || payroll.status === 'calculated') && canUpdate(MODULES.PAYROLL) && (
                                <Button size="sm" variant="ghost" onClick={() => handleEditPayroll(payroll)} title={t('edit')}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleDownloadPayslip(payroll)} title={t('download')}>
                                <Download className="w-4 h-4" />
                              </Button>
                              {(payroll.status === 'draft' || payroll.status === 'calculated') && canDelete(MODULES.PAYROLL) && (
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(payroll)} title={t('delete')}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_payroll_confirm')} <strong>{payrollToDelete?.payroll_number}</strong>? {t('action_cannot_undone')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setPayrollToDelete(null); }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePayroll}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Payroll Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('process_payroll')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payroll_number_label')}</label>
                  <Input
                    placeholder={t('auto_generated')}
                    value={newPayroll.payroll_number}
                    onChange={(e) => setNewPayroll({...newPayroll, payroll_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('employee')} *</label>
                  <Select value={newPayroll.employee_name} onValueChange={(value) => {
                    const selectedEmployee = employees.find(emp => emp.full_name === value);
                    setNewPayroll({
                      ...newPayroll,
                      employee_id: selectedEmployee?.id,
                      employee_name: value,
                      basic_salary: selectedEmployee?.salary || selectedEmployee?.base_salary || 0
                    });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_employee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.full_name}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('pay_period_start')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_start}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('pay_period_end')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_end}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_end: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_date')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.payment_date}
                    onChange={(e) => setNewPayroll({...newPayroll, payment_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">{t('earnings')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('basic_salary')} *</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.basic_salary)}
                      onChange={(e) => setNewPayroll({...newPayroll, basic_salary: parsePriceInput(e.target.value)})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('overtime_hours')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newPayroll.overtime_hours}
                      onChange={(e) => setNewPayroll({...newPayroll, overtime_hours: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('bonuses')}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.bonuses)}
                      onChange={(e) => setNewPayroll({...newPayroll, bonuses: parsePriceInput(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('allowances')}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.allowances)}
                      onChange={(e) => setNewPayroll({...newPayroll, allowances: parsePriceInput(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              {newPayroll.basic_salary > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold mb-3">{t('payroll_summary')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t('gross_pay')}:</span>
                      <span className="font-semibold">{formatCurrency(calculatePayroll(newPayroll).gross_pay)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>{t('total_deductions')}:</span>
                      <span className="font-semibold">-{formatCurrency(calculatePayroll(newPayroll).total_deductions)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t text-lg">
                      <span className="font-bold">{t('net_pay')}:</span>
                      <span className="font-bold text-green-600">{formatCurrency(calculatePayroll(newPayroll).net_pay)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreatePayroll}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newPayroll.employee_name || !newPayroll.basic_salary}
                >
                  {t('process_payroll')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Payroll Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('edit_payroll')} - {editPayroll?.payroll_number}</DialogTitle>
            </DialogHeader>
            {editPayroll && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('payroll_number_label')}</label>
                    <Input
                      value={editPayroll.payroll_number}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('employee')} *</label>
                    <Select value={editPayroll.employee_name} onValueChange={(value) => {
                      const selectedEmployee = employees.find(emp => emp.full_name === value);
                      setEditPayroll({
                        ...editPayroll,
                        employee_name: value,
                        basic_salary: selectedEmployee?.salary || editPayroll.basic_salary
                      });
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.full_name}>{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('pay_period_start')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.pay_period_start}
                      onChange={(e) => setEditPayroll({...editPayroll, pay_period_start: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('pay_period_end')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.pay_period_end}
                      onChange={(e) => setEditPayroll({...editPayroll, pay_period_end: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('payment_date')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.payment_date}
                      onChange={(e) => setEditPayroll({...editPayroll, payment_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">{t('earnings')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('basic_salary')} *</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.basic_salary)}
                        onChange={(e) => setEditPayroll({...editPayroll, basic_salary: parsePriceInput(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('overtime_hours')}</label>
                      <Input
                        type="number"
                        value={editPayroll.overtime_hours}
                        onChange={(e) => setEditPayroll({...editPayroll, overtime_hours: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('bonuses')}</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.bonuses)}
                        onChange={(e) => setEditPayroll({...editPayroll, bonuses: parsePriceInput(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('allowances')}</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.allowances)}
                        onChange={(e) => setEditPayroll({...editPayroll, allowances: parsePriceInput(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                  <Select value={editPayroll.status} onValueChange={(value) => setEditPayroll({...editPayroll, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="calculated">{t('calculated')}</SelectItem>
                      <SelectItem value="approved">{t('approved')}</SelectItem>
                      <SelectItem value="paid">{t('paid')}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editPayroll.basic_salary > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-3">{t('payroll_summary')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{t('gross_pay')}:</span>
                        <span className="font-semibold">{formatCurrency(calculatePayroll(editPayroll).gross_pay)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>{t('total_deductions')}:</span>
                        <span className="font-semibold">-{formatCurrency(calculatePayroll(editPayroll).total_deductions)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t text-lg">
                        <span className="font-bold">{t('net_pay')}:</span>
                        <span className="font-bold text-green-600">{formatCurrency(calculatePayroll(editPayroll).net_pay)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPayroll(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdatePayroll}
                    className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                    disabled={!editPayroll.employee_name || !editPayroll.basic_salary}
                  >
                    {t('save_changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
