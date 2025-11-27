import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Upload, CheckCircle, XCircle, Clock, DollarSign, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Expenses() {
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newClaim, setNewClaim] = useState({
    claim_number: '',
    employee_name: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'travel',
    amount: 0,
    description: ''
  });

  useEffect(() => {
    loadClaims();
  }, []);

  useEffect(() => {
    let filtered = claims;
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
  }, [claims, searchQuery, statusFilter]);

  const loadClaims = async () => {
    try {
      const data = await base44.entities.ExpenseClaim.list('-created_date', 100);
      setClaims(data);
      setFilteredClaims(data);
    } catch (error) {
      console.error('Error loading expense claims:', error);
    }
    setIsLoading(false);
  };

  const handleReceiptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const extractedData = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            merchant_name: { type: "string" },
            date: { type: "string" },
            total_amount: { type: "number" },
            category: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (extractedData.status === 'success') {
        setNewClaim({
          ...newClaim,
          expense_date: extractedData.output.date || newClaim.expense_date,
          amount: extractedData.output.total_amount || 0,
          description: extractedData.output.merchant_name || ''
        });
      }
    } catch (error) {
      console.error('Error processing receipt:', error);
    }
    setIsProcessing(false);
  };

  const handleCreateClaim = async () => {
    try {
      const claimData = {
        ...newClaim,
        claim_number: newClaim.claim_number || `EXP-${Date.now()}`,
        amount: parseFloat(newClaim.amount),
        status: 'draft',
        claim_date: new Date().toISOString().split('T')[0]
      };
      
      await base44.entities.ExpenseClaim.create(claimData);
      setShowCreateModal(false);
      loadClaims();
      
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
    }
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    try {
      const updates = { status: newStatus };
      if (newStatus === 'approved') {
        updates.approval_date = new Date().toISOString().split('T')[0];
      }
      if (newStatus === 'paid') {
        updates.payment_date = new Date().toISOString().split('T')[0];
      }
      await base44.entities.ExpenseClaim.update(claimId, updates);
      loadClaims();
    } catch (error) {
      console.error('Error updating claim:', error);
    }
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
    totalClaims: claims.length,
    totalAmount: claims.reduce((sum, c) => sum + (c.amount || 0), 0),
    pendingApproval: claims.filter(c => c.status === 'submitted').length,
    pendingPayment: claims.filter(c => c.status === 'approved').length
  };

  const categoryData = {};
  claims.forEach(c => {
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Category Breakdown */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.name}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
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
              
              {/* AI Receipt Upload */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-3">
                  Upload receipt - AI will extract data automatically
                </p>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleReceiptUpload}
                  disabled={isProcessing}
                />
                {isProcessing && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-teal-600">
                    <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    Processing receipt...
                  </div>
                )}
              </div>

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
                  disabled={!newClaim.employee_name || !newClaim.amount}
                >
                  Submit Claim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}