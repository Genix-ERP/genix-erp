import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, DollarSign, Users, Calculator, TrendingUp, Brain, Download } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Payroll() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filteredPayrolls, setFilteredPayrolls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newPayroll, setNewPayroll] = useState({
    payroll_number: '',
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
    loadData();
  }, []);

  useEffect(() => {
    let filtered = payrolls;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.payroll_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredPayrolls(filtered);
  }, [payrolls, searchQuery, statusFilter]);

  const loadData = async () => {
    try {
      const [payrollData, empData] = await Promise.all([
        base44.entities.Payroll.list('-created_date', 100),
        base44.entities.Employee.list()
      ]);
      setPayrolls(payrollData);
      setFilteredPayrolls(payrollData);
      setEmployees(empData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const calculatePayroll = (data) => {
    const basicSalary = parseFloat(data.basic_salary) || 0;
    const overtimeHours = parseFloat(data.overtime_hours) || 0;
    const overtimePay = overtimeHours * (basicSalary / 160); // Assuming 160 hours/month
    const bonuses = parseFloat(data.bonuses) || 0;
    const allowances = parseFloat(data.allowances) || 0;
    
    const grossPay = basicSalary + overtimePay + bonuses + allowances;
    
    // Simple tax calculation (20% on amount over $3000)
    const taxableAmount = Math.max(0, grossPay - 3000);
    const taxDeduction = taxableAmount * 0.20;
    
    const socialSecurity = grossPay * 0.062; // 6.2%
    const healthInsurance = 200; // Flat rate
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

  const handleCreatePayroll = async () => {
    try {
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
      
      await base44.entities.Payroll.create(payrollData);
      setShowCreateModal(false);
      loadData();
      
      setNewPayroll({
        payroll_number: '',
        employee_name: '',
        pay_period_start: '',
        pay_period_end: '',
        payment_date: '',
        basic_salary: 0,
        overtime_hours: 0,
        bonuses: 0,
        allowances: 0
      });
    } catch (error) {
      console.error('Error creating payroll:', error);
    }
  };

  const updatePayrollStatus = async (payrollId, newStatus) => {
    try {
      await base44.entities.Payroll.update(payrollId, { status: newStatus });
      loadData();
    } catch (error) {
      console.error('Error updating payroll:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      calculated: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors.draft;
  };

  const metrics = {
    totalPayrolls: payrolls.length,
    totalGrossPay: payrolls.reduce((sum, p) => sum + (p.gross_pay || 0), 0),
    totalNetPay: payrolls.reduce((sum, p) => sum + (p.net_pay || 0), 0),
    pendingPayments: payrolls.filter(p => p.status === 'approved').length
  };

  // Monthly payroll data
  const monthlyData = {};
  payrolls.forEach(p => {
    const month = p.pay_period_end ? new Date(p.pay_period_end).toLocaleDateString('en-US', { month: 'short' }) : 'Unknown';
    monthlyData[month] = (monthlyData[month] || 0) + (p.net_pay || 0);
  });
  const chartData = Object.entries(monthlyData).slice(-6).map(([month, amount]) => ({ month, amount }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Payroll Management</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Automated payroll processing with tax calculations and compliance</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalPayrolls}</p>
              <p className="text-sm text-slate-600">Total Payrolls</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalGrossPay.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Gross Pay</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalNetPay.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Net Pay</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.pendingPayments}</p>
              <p className="text-sm text-slate-600">Pending Payments</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Payroll Trend */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Monthly Payroll</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Payroll Table */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Payroll Records</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600">
                  <Plus className="w-4 h-4 mr-2" /> Process Payroll
                </Button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search payrolls..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="calculated">Calculated</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredPayrolls.length === 0 ? (
                <div className="text-center py-16">
                  <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No payroll records yet</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">Process First Payroll</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Payroll #</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayrolls.map((payroll) => (
                        <TableRow key={payroll.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{payroll.payroll_number}</TableCell>
                          <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                          <TableCell className="text-sm">
                            {payroll.pay_period_start && payroll.pay_period_end ? 
                              `${format(new Date(payroll.pay_period_start), 'MMM dd')} - ${format(new Date(payroll.pay_period_end), 'MMM dd')}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">${(payroll.gross_pay || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-green-600">${(payroll.net_pay || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(payroll.status)}>{payroll.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {payroll.status === 'calculated' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePayrollStatus(payroll.id, 'approved')}>
                                  Approve
                                </Button>
                              )}
                              {payroll.status === 'approved' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePayrollStatus(payroll.id, 'paid')}>
                                  Pay
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
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
        </div>

        {/* Create Payroll Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Process Payroll</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Payroll Number</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newPayroll.payroll_number}
                    onChange={(e) => setNewPayroll({...newPayroll, payroll_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Employee *</label>
                  <Select value={newPayroll.employee_name} onValueChange={(value) => setNewPayroll({...newPayroll, employee_name: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
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
                  <label className="text-sm font-medium mb-1 block">Pay Period Start *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_start}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pay Period End *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_end}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_end: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Date *</label>
                  <Input
                    type="date"
                    value={newPayroll.payment_date}
                    onChange={(e) => setNewPayroll({...newPayroll, payment_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Earnings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Basic Salary *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newPayroll.basic_salary}
                      onChange={(e) => setNewPayroll({...newPayroll, basic_salary: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Overtime Hours</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newPayroll.overtime_hours}
                      onChange={(e) => setNewPayroll({...newPayroll, overtime_hours: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Bonuses</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newPayroll.bonuses}
                      onChange={(e) => setNewPayroll({...newPayroll, bonuses: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Allowances</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newPayroll.allowances}
                      onChange={(e) => setNewPayroll({...newPayroll, allowances: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {newPayroll.basic_salary > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold mb-3">Payroll Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Gross Pay:</span>
                      <span className="font-semibold">${calculatePayroll(newPayroll).gross_pay.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Total Deductions:</span>
                      <span className="font-semibold">-${calculatePayroll(newPayroll).total_deductions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t text-lg">
                      <span className="font-bold">Net Pay:</span>
                      <span className="font-bold text-green-600">${calculatePayroll(newPayroll).net_pay.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreatePayroll} 
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
                  disabled={!newPayroll.employee_name || !newPayroll.basic_salary}
                >
                  Process Payroll
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}