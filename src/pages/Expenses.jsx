import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Upload, CheckCircle, XCircle, Clock, DollarSign, Brain, AlertTriangle, Target, Lightbulb, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { analyzeExpenses } from '@/api/services/aiAnalytics';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Expenses() {
  const { expenses, createExpense, updateExpense, isLoading } = useModules();

  // AI Analysis
  const expenseAnalysis = useMemo(() => analyzeExpenses(expenses), [expenses]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClaim, setEditClaim] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newClaim, setNewClaim] = useState({
    claim_number: '',
    employee_name: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'travel',
    amount: 0,
    description: ''
  });

  useEffect(() => {
    let filtered = expenses;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.claim_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredClaims(filtered);
  }, [expenses, searchQuery, statusFilter]);

  const handleCreateClaim = async () => {
    setIsSubmitting(true);
    try {
      const claimData = {
        ...newClaim,
        claim_number: newClaim.claim_number || `EXP-${Date.now()}`,
        amount: parseFloat(newClaim.amount),
        status: 'draft',
        claim_date: new Date().toISOString().split('T')[0]
      };

      await createExpense(claimData);
      setShowCreateModal(false);

      setNewClaim({
        claim_number: '',
        employee_name: '',
        expense_date: new Date().toISOString().split('T')[0],
        category: 'travel',
        amount: 0,
        description: ''
      });
    } catch (error) {
      console.error('Error creating claim:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClaim = (claim) => {
    setEditClaim({
      ...claim,
      amount: claim.amount || 0
    });
    setShowEditModal(true);
  };

  const handleUpdateClaim = async () => {
    if (!editClaim) return;

    setIsSubmitting(true);
    try {
      updateExpense(editClaim.id, {
        claim_number: editClaim.claim_number,
        employee_name: editClaim.employee_name,
        expense_date: editClaim.expense_date,
        category: editClaim.category,
        amount: parseFloat(editClaim.amount) || 0,
        description: editClaim.description,
        status: editClaim.status
      });
      setShowEditModal(false);
      setEditClaim(null);
    } catch (error) {
      console.error('Error updating claim:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateClaimStatus = (claimId, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'approved') {
      updates.approval_date = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'paid') {
      updates.payment_date = new Date().toISOString().split('T')[0];
    }
    updateExpense(claimId, updates);
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      paid: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors.draft;
  };

  const metrics = {
    totalClaims: expenses.length,
    totalAmount: expenses.reduce((sum, c) => sum + (c.amount || 0), 0),
    pendingApproval: expenses.filter(c => c.status === 'submitted').length,
    pendingPayment: expenses.filter(c => c.status === 'approved').length
  };

  const categoryData = {};
  expenses.forEach(c => {
    categoryData[c.category] = (categoryData[c.category] || 0) + (c.amount || 0);
  });
  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Receipt className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Expense Management</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Submit, track, and manage employee expenses with AI receipt scanning</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalClaims}</p>
              <p className="text-sm text-slate-600">Total Claims</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalAmount.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Total Amount</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.pendingApproval}</p>
              <p className="text-sm text-slate-600">Pending Approval</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.pendingPayment}</p>
              <p className="text-sm text-slate-600">Pending Payment</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(expenseAnalysis.insights.length > 0 || expenseAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-teal-600" />
                AI Expense Insights
                <Badge className="bg-teal-100 text-teal-700 text-xs">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {expenseAnalysis.insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-teal-100">
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
                          <p className="text-lg font-bold text-teal-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {expenseAnalysis.recommendations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {expenseAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs bg-white rounded-full px-3 py-1.5 border border-teal-100">
                      <Lightbulb className="w-3 h-3 text-yellow-500" />
                      <span className="text-slate-700">{rec.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Category Breakdown */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={40}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Claims Table */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Expense Claims</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-teal-600 to-cyan-600">
                  <Plus className="w-4 h-4 mr-2" /> New Claim
                </Button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search claims..."
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
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No expense claims yet</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">Submit First Claim</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Claim #</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClaims.map((claim) => (
                        <TableRow key={claim.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{claim.claim_number}</TableCell>
                          <TableCell className="font-medium">{claim.employee_name}</TableCell>
                          <TableCell className="text-sm">
                            {claim.expense_date ? format(new Date(claim.expense_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{claim.category}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">${(claim.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(claim.status)}>{claim.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleEditClaim(claim)} title="Edit Claim">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {claim.status === 'draft' && (
                                <Button size="sm" variant="ghost" onClick={() => updateClaimStatus(claim.id, 'submitted')}>
                                  Submit
                                </Button>
                              )}
                              {claim.status === 'submitted' && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => updateClaimStatus(claim.id, 'approved')}>
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => updateClaimStatus(claim.id, 'rejected')}>
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {claim.status === 'approved' && (
                                <Button size="sm" variant="ghost" onClick={() => updateClaimStatus(claim.id, 'paid')}>
                                  Pay
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
        </div>

        {/* Create Claim Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-teal-600" />
                Submit Expense Claim
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Claim Number</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newClaim.claim_number}
                    onChange={(e) => setNewClaim({...newClaim, claim_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Employee Name *</label>
                  <Input
                    placeholder="Your name"
                    value={newClaim.employee_name}
                    onChange={(e) => setNewClaim({...newClaim, employee_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Expense Date *</label>
                  <Input
                    type="date"
                    value={newClaim.expense_date}
                    onChange={(e) => setNewClaim({...newClaim, expense_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category *</label>
                  <Select value={newClaim.category} onValueChange={(value) => setNewClaim({...newClaim, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="meals">Meals</SelectItem>
                      <SelectItem value="accommodation">Accommodation</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                      <SelectItem value="office_supplies">Office Supplies</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newClaim.amount}
                    onChange={(e) => setNewClaim({...newClaim, amount: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Input
                  placeholder="Expense description"
                  value={newClaim.description}
                  onChange={(e) => setNewClaim({...newClaim, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateClaim}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600"
                  disabled={!newClaim.employee_name || !newClaim.amount || isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Claim Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Expense Claim</DialogTitle>
            </DialogHeader>
            {editClaim && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Claim Number</label>
                    <Input
                      value={editClaim.claim_number}
                      onChange={(e) => setEditClaim({...editClaim, claim_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Employee Name *</label>
                    <Input
                      value={editClaim.employee_name}
                      onChange={(e) => setEditClaim({...editClaim, employee_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Expense Date</label>
                    <Input
                      type="date"
                      value={editClaim.expense_date?.split('T')[0] || ''}
                      onChange={(e) => setEditClaim({...editClaim, expense_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <Select value={editClaim.category || 'travel'} onValueChange={(value) => setEditClaim({...editClaim, category: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="meals">Meals</SelectItem>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                        <SelectItem value="transportation">Transportation</SelectItem>
                        <SelectItem value="office_supplies">Office Supplies</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Amount *</label>
                    <Input
                      type="number"
                      value={editClaim.amount}
                      onChange={(e) => setEditClaim({...editClaim, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={editClaim.status || 'draft'} onValueChange={(value) => setEditClaim({...editClaim, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <Input
                    value={editClaim.description || ''}
                    onChange={(e) => setEditClaim({...editClaim, description: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditClaim(null); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateClaim}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600"
                    disabled={!editClaim.employee_name || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
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
