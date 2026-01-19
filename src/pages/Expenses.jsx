import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Upload, CheckCircle, XCircle, Clock, DollarSign, Brain, AlertTriangle, Target, Lightbulb, Edit2, Download, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { analyzeExpenses } from '@/api/services/aiAnalytics';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import * as XLSX from 'xlsx';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Expenses() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user } = useAuth();
  const { expenses, createExpense, updateExpense, isLoading } = useModules();

  // AI Analysis
  const expenseAnalysis = useMemo(() => analyzeExpenses(expenses, language), [expenses, language]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClaim, setEditClaim] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState(null);

  const [newClaim, setNewClaim] = useState({
    claim_number: '',
    employee_name: user?.full_name || '',
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
        employee_name: user?.full_name || '',
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

  const handleDeleteClick = (claim) => {
    setClaimToDelete(claim);
    setShowDeleteDialog(true);
  };

  const handleDeleteClaim = () => {
    if (claimToDelete) {
      // For demo purposes, we'll update status to 'cancelled' instead of actually deleting
      updateExpense(claimToDelete.id, { status: 'cancelled' });
      setShowDeleteDialog(false);
      setClaimToDelete(null);
    }
  };

  const handleRecommendationClick = (recommendation) => {
    // Generate proper prompt based on recommendation type and language
    let prompt = '';

    if (recommendation.action.includes('Set Category Budgets') || recommendation.action.includes('Toifa byudjetlarini belgilash') || recommendation.action.includes('Установка бюджетов по категориям')) {
      // Set category budgets prompt
      if (language === 'uz') {
        prompt = 'Xarajat toifalari uchun byudjet chegaralarini qanday belgilashim kerak? Har bir toifa uchun optimal xarajat limitlarini aniqlashda menga yordam bering.';
      } else if (language === 'ru') {
        prompt = 'Как мне установить бюджетные лимиты для категорий расходов? Помогите мне определить оптимальные лимиты расходов для каждой категории.';
      } else {
        prompt = 'How should I set budget limits for expense categories? Help me determine optimal spending limits for each category.';
      }
    } else if (recommendation.action.includes('Review Pending') || recommendation.action.includes('Kutilayotgan xarajatlarni') || recommendation.action.includes('Проверка ожидающих')) {
      // Review pending expenses prompt
      const pending = expenses.filter(e => e.status === 'pending' || e.status === 'submitted').length;
      if (language === 'uz') {
        prompt = `Menda ${pending} ta kutilayotgan xarajat tasdiqlanishi kerak. Xarajatlarni ko'rib chiqish va tasdiqlash jarayonini qanday tartibga solishim mumkin?`;
      } else if (language === 'ru') {
        prompt = `У меня ${pending} расходов ожидают одобрения. Как я могу организовать процесс проверки и одобрения расходов?`;
      } else {
        prompt = `I have ${pending} expenses awaiting approval. How can I streamline the expense review and approval process?`;
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

  const handleExportToExcel = () => {
    // Prepare data for export
    const exportData = filteredClaims.map(claim => ({
      [t('claim_number')]: claim.claim_number,
      [t('employee')]: claim.employee_name,
      [t('expense_date')]: claim.expense_date ? format(new Date(claim.expense_date), 'dd.MM.yyyy') : '',
      [t('category')]: t(claim.category),
      [t('amount')]: claim.amount,
      [t('description')]: claim.description,
      [t('status')]: t(claim.status),
      [t('submission_date')]: claim.submission_date ? format(new Date(claim.submission_date), 'dd.MM.yyyy') : '',
      [t('approval_date')]: claim.approval_date ? format(new Date(claim.approval_date), 'dd.MM.yyyy') : '',
      [t('payment_date')]: claim.payment_date ? format(new Date(claim.payment_date), 'dd.MM.yyyy') : ''
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Claim Number
      { wch: 20 }, // Employee
      { wch: 12 }, // Expense Date
      { wch: 15 }, // Category
      { wch: 12 }, // Amount
      { wch: 30 }, // Description
      { wch: 12 }, // Status
      { wch: 12 }, // Submission Date
      { wch: 12 }, // Approval Date
      { wch: 12 }  // Payment Date
    ];
    worksheet['!cols'] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('expense_claims'));

    // Generate filename with current date
    const filename = `expense_claims_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // Download
    XLSX.writeFile(workbook, filename);
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      paid: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-slate-100 text-slate-800'
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
  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name: t(name), value }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_claims')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_amount')}</p>
                  <p className="text-2xl font-bold text-slate-900">${metrics.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('pending_approval')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.pendingApproval}</p>
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
                  <p className="text-xs text-slate-600">{t('pending_payment')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.pendingPayment}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(expenseAnalysis.insights.length > 0 || expenseAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-teal-600" />
                {t('ai_expense_insights')}
                <Badge className="bg-teal-100 text-teal-700 text-xs">{t('live')}</Badge>
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
                    <button
                      key={index}
                      onClick={() => handleRecommendationClick(rec)}
                      className="flex items-center gap-2 text-xs bg-white rounded-full px-3 py-1.5 border border-teal-100 hover:bg-teal-50 hover:border-teal-300 transition-colors cursor-pointer"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Category Breakdown */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>{t('expenses_by_category')}</CardTitle>
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
                <CardTitle>{t('expense_claims')}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportToExcel}
                    variant="outline"
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    <Download className="w-4 h-4 mr-2" /> {t('export')}
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-teal-600 to-cyan-600">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_claim')}
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_claims')}
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
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="draft">{t('draft')}</SelectItem>
                    <SelectItem value="submitted">{t('submitted')}</SelectItem>
                    <SelectItem value="approved">{t('approved')}</SelectItem>
                    <SelectItem value="rejected">{t('rejected')}</SelectItem>
                    <SelectItem value="paid">{t('paid')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
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
                  <p className="text-slate-500">{t('no_expense_claims_yet')}</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('submit_first_claim')}</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('claim_number')}</TableHead>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('date')}</TableHead>
                        <TableHead>{t('category')}</TableHead>
                        <TableHead>{t('amount')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClaims.map((claim) => (
                        <TableRow key={claim.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{claim.claim_number}</TableCell>
                          <TableCell className="font-medium">{claim.employee_name}</TableCell>
                          <TableCell className="text-sm">
                            {claim.expense_date ? format(new Date(claim.expense_date), 'dd.MM.yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t(claim.category)}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">${(claim.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(claim.status)}>{t(claim.status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleEditClaim(claim)} title={t('edit_claim')}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {claim.status === 'draft' && (
                                <Button size="sm" variant="ghost" onClick={() => updateClaimStatus(claim.id, 'submitted')}>
                                  {t('submit')}
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
                                  {t('pay')}
                                </Button>
                              )}
                              {(claim.status === 'draft' || claim.status === 'rejected') && (
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(claim)} title={t('delete_claim')}>
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
        </div>

        {/* Create Claim Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-teal-600" />
                {t('submit_expense_claim')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('claim_number_label')}</label>
                  <Input
                    placeholder={t('auto_generated_if_empty')}
                    value={newClaim.claim_number}
                    onChange={(e) => setNewClaim({...newClaim, claim_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('employee_name')}</label>
                  <Input
                    value={newClaim.employee_name}
                    disabled
                    className="bg-slate-50 text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('expense_date')} *</label>
                  <Input
                    type="date"
                    value={newClaim.expense_date}
                    onChange={(e) => setNewClaim({...newClaim, expense_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('category')} *</label>
                  <Select value={newClaim.category} onValueChange={(value) => setNewClaim({...newClaim, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="travel">{t('travel')}</SelectItem>
                      <SelectItem value="meals">{t('meals')}</SelectItem>
                      <SelectItem value="accommodation">{t('accommodation')}</SelectItem>
                      <SelectItem value="transportation">{t('transportation')}</SelectItem>
                      <SelectItem value="office_supplies">{t('office_supplies')}</SelectItem>
                      <SelectItem value="training">{t('training')}</SelectItem>
                      <SelectItem value="other">{t('other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('amount')} *</label>
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
                <label className="text-sm font-medium mb-1 block">{t('description')}</label>
                <Input
                  placeholder={t('expense_description')}
                  value={newClaim.description}
                  onChange={(e) => setNewClaim({...newClaim, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateClaim}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600"
                  disabled={!newClaim.amount || isSubmitting}
                >
                  {isSubmitting ? t('submitting') : t('submit_claim')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete_claim')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_claim_confirm')} <strong>{claimToDelete?.claim_number}</strong>? {t('action_cannot_undone')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteClaim}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Claim Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('edit_expense_claim')}</DialogTitle>
            </DialogHeader>
            {editClaim && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('claim_number_label')}</label>
                    <Input
                      value={editClaim.claim_number}
                      onChange={(e) => setEditClaim({...editClaim, claim_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('employee_name')} *</label>
                    <Input
                      value={editClaim.employee_name}
                      onChange={(e) => setEditClaim({...editClaim, employee_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('expense_date')}</label>
                    <Input
                      type="date"
                      value={editClaim.expense_date?.split('T')[0] || ''}
                      onChange={(e) => setEditClaim({...editClaim, expense_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('category')}</label>
                    <Select value={editClaim.category || 'travel'} onValueChange={(value) => setEditClaim({...editClaim, category: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">{t('travel')}</SelectItem>
                        <SelectItem value="meals">{t('meals')}</SelectItem>
                        <SelectItem value="accommodation">{t('accommodation')}</SelectItem>
                        <SelectItem value="transportation">{t('transportation')}</SelectItem>
                        <SelectItem value="office_supplies">{t('office_supplies')}</SelectItem>
                        <SelectItem value="training">{t('training')}</SelectItem>
                        <SelectItem value="other">{t('other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('amount')} *</label>
                    <Input
                      type="number"
                      value={editClaim.amount}
                      onChange={(e) => setEditClaim({...editClaim, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                  <Select value={editClaim.status || 'draft'} onValueChange={(value) => setEditClaim({...editClaim, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="submitted">{t('submitted')}</SelectItem>
                      <SelectItem value="approved">{t('approved')}</SelectItem>
                      <SelectItem value="rejected">{t('rejected')}</SelectItem>
                      <SelectItem value="paid">{t('paid')}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('description')}</label>
                  <Input
                    value={editClaim.description || ''}
                    onChange={(e) => setEditClaim({...editClaim, description: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditClaim(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateClaim}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600"
                    disabled={!editClaim.employee_name || isSubmitting}
                  >
                    {isSubmitting ? t('saving') : t('save_changes')}
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
