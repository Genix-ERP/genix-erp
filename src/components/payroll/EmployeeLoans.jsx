import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, CreditCard, CheckCircle, Clock, AlertTriangle, User, Wallet, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import hrService from '@/api/services/hr';
import { financeService } from '@/api/services/finance';

export default function EmployeeLoans() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { employees } = useModules();
  const { canCreate, canUpdate, MODULES } = usePermissions();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState(null);
  const [expandedLoanData, setExpandedLoanData] = useState(null);
  const [accounts, setAccounts] = useState([]);

  // Create loan form
  const [loanForm, setLoanForm] = useState({
    employee_id: '',
    amount: '',
    duration_months: '',
    start_date: new Date().toISOString().split('T')[0],
    reason: '',
    cash_account_id: '',
  });

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await hrService.listEmployeeLoans({ limit: 100 });
      setLoans(data?.data || []);
    } catch (e) {
      console.error('Failed to load loans:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await financeService.listAccounts({ limit: 200 });
      const items = data?.items || data || [];
      setAccounts(items.filter(a => ['1000', '1010', '1020'].includes(a.code) || a.code?.startsWith('10')));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadLoans(); loadAccounts(); }, [loadLoans, loadAccounts]);

  const handleExpandLoan = async (loanId) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
      setExpandedLoanData(null);
      return;
    }
    try {
      const data = await hrService.getEmployeeLoan(loanId);
      setExpandedLoanData(data);
      setExpandedLoan(loanId);
    } catch (e) { console.error(e); }
  };

  const selectedEmployee = employees.find(e => e.id === loanForm.employee_id);
  const monthlyPayment = loanForm.amount && loanForm.duration_months
    ? Math.ceil(parseFloat(loanForm.amount) / parseInt(loanForm.duration_months))
    : 0;

  const endDate = loanForm.start_date && loanForm.duration_months
    ? (() => {
        const d = new Date(loanForm.start_date);
        d.setMonth(d.getMonth() + parseInt(loanForm.duration_months));
        return d.toISOString().split('T')[0];
      })()
    : '';

  // Payment schedule preview
  const paymentPreview = [];
  if (loanForm.amount && loanForm.duration_months && loanForm.start_date) {
    let rem = parseFloat(loanForm.amount);
    const months = parseInt(loanForm.duration_months);
    const mp = Math.ceil(rem / months);
    const uzMonths = ['', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    for (let i = 0; i < months && i < 5; i++) {
      const d = new Date(loanForm.start_date);
      d.setMonth(d.getMonth() + i);
      const pay = Math.min(mp, rem);
      rem -= pay;
      paymentPreview.push({ month: `${uzMonths[d.getMonth() + 1]} ${d.getFullYear()}`, payment: pay, remaining: rem });
    }
  }

  const handleCreateLoan = async () => {
    try {
      await hrService.createEmployeeLoan({
        employee_id: loanForm.employee_id,
        amount: parseFloat(loanForm.amount),
        duration_months: parseInt(loanForm.duration_months),
        start_date: loanForm.start_date,
        reason: loanForm.reason,
        cash_account_id: loanForm.cash_account_id,
      });
      setShowCreateModal(false);
      setLoanForm({ employee_id: '', amount: '', duration_months: '', start_date: new Date().toISOString().split('T')[0], reason: '', cash_account_id: '' });
      loadLoans();
    } catch (e) {
      console.error('Failed to create loan:', e);
      alert(e.response?.data?.error?.message || 'Failed to create loan');
    }
  };

  const handleMarkPaid = async (loanId, paymentId) => {
    try {
      await hrService.markLoanPaymentPaid(loanId, paymentId);
      const data = await hrService.getEmployeeLoan(loanId);
      setExpandedLoanData(data);
      loadLoans();
    } catch (e) { console.error(e); }
  };

  const fmt = (n) => String(Number(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmtInput = (v) => {
    const num = String(v).replace(/[^0-9]/g, '');
    return num ? num.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
  };
  const parseInput = (v) => String(v).replace(/[^0-9]/g, '');

  const activeLoans = loans.filter(l => l.status === 'active');
  const completedLoans = loans.filter(l => l.status === 'completed');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
  const totalLent = loans.reduce((sum, l) => sum + (l.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 border-slate-200/60 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><CreditCard className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-slate-500">{t('active_loans')}</p>
                <p className="text-xl font-bold text-slate-900">{activeLoans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 border-slate-200/60 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100"><Wallet className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-slate-500">{t('remaining_debt')}</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalOutstanding)} so'm</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 border-slate-200/60 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-slate-500">{t('closed')}</p>
                <p className="text-xl font-bold text-slate-900">{completedLoans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 border-slate-200/60 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><CreditCard className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-slate-500">{t('total_issued')}</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalLent)} so'm</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loans list */}
      <Card className="bg-white/80 border-slate-200/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">{t('loan_list_title')}</CardTitle>
          {canCreate(MODULES.HR) && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> {t('grant_loan')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-8">{t('loading_dots')}</p>
          ) : loans.length === 0 ? (
            <p className="text-center text-slate-500 py-8">{t('no_loans_found')}</p>
          ) : (
            <div className="space-y-3">
              {loans.map(loan => {
                const paidPercent = loan.amount > 0 ? Math.round((loan.paid_amount / loan.amount) * 100) : 0;
                const isExpanded = expandedLoan === loan.id;
                return (
                  <div key={loan.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => handleExpandLoan(loan.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm">
                          {loan.employee_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{loan.employee_name}</p>
                          <p className="text-sm text-slate-500">{loan.loan_number} · {loan.start_date} — {loan.end_date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{fmt(loan.remaining_amount)} so'm</p>
                          <p className="text-xs text-slate-500">{t('remains_of')} {fmt(loan.amount)} so'm</p>
                        </div>
                        <div className="w-24">
                          <Progress value={paidPercent} className="h-2" />
                          <p className="text-xs text-center text-slate-500 mt-1">{paidPercent}%</p>
                        </div>
                        <Badge className={loan.status === 'active' ? 'bg-blue-100 text-blue-800' : loan.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                          {loan.status === 'active' ? t('active') : loan.status === 'completed' ? t('closed') : loan.status}
                        </Badge>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                    {isExpanded && expandedLoanData && (
                      <div className="border-t bg-slate-50/50 p-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-slate-900 text-white rounded-lg p-3 text-center">
                            <p className="text-xs text-slate-400">{t('issued')}</p>
                            <p className="text-lg font-bold">{fmt(expandedLoanData.amount)}</p>
                          </div>
                          <div className="bg-blue-600 text-white rounded-lg p-3 text-center">
                            <p className="text-xs text-blue-200">{t('remaining')}</p>
                            <p className="text-lg font-bold">{fmt(expandedLoanData.remaining_amount)}</p>
                          </div>
                          <div className="bg-green-600 text-white rounded-lg p-3 text-center">
                            <p className="text-xs text-green-200">{t('paid_amount')}</p>
                            <p className="text-lg font-bold">{fmt(expandedLoanData.paid_amount)}</p>
                          </div>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-100">
                              <TableHead>{t('month_col')}</TableHead>
                              <TableHead className="text-right">{t('payment_col')}</TableHead>
                              <TableHead className="text-right">{t('balance_col')}</TableHead>
                              <TableHead>{t('status_col')}</TableHead>
                              {canUpdate(MODULES.HR) && <TableHead className="text-right">{t('action_col')}</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(expandedLoanData.payments || []).map(p => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.month_label}</TableCell>
                                <TableCell className="text-right">{fmt(p.amount)}</TableCell>
                                <TableCell className="text-right">{fmt(p.remaining_after)}</TableCell>
                                <TableCell>
                                  {p.status === 'paid' ? (
                                    <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> {t('paid_status')}</Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" /> {t('pending_status')}</Badge>
                                  )}
                                </TableCell>
                                {canUpdate(MODULES.HR) && (
                                  <TableCell className="text-right">
                                    {p.status === 'pending' && (
                                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleMarkPaid(loan.id, p.id); }}>
                                        <CheckCircle className="w-3 h-3 mr-1" /> {t('paid_status')}
                                      </Button>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Loan Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">{t('grant_loan_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">{t('employee_label')} *</Label>
              <Select value={loanForm.employee_id} onValueChange={v => setLoanForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder={t('select_employee')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(emp => emp.status === 'active').map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.job_title || t('employee_default')} · {fmt(emp.salary || 0)} so'm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-300">{t('loan_amount')} *</Label>
                <Input className="bg-slate-800 border-slate-600 text-white" value={fmtInput(loanForm.amount)}
                  onChange={e => setLoanForm(p => ({ ...p, amount: parseInput(e.target.value) }))} placeholder="3 000 000" />
              </div>
              <div>
                <Label className="text-slate-300">{t('duration_months')} *</Label>
                <Input type="number" className="bg-slate-800 border-slate-600 text-white" value={loanForm.duration_months}
                  onChange={e => setLoanForm(p => ({ ...p, duration_months: e.target.value }))} placeholder="10" />
              </div>
              <div>
                <Label className="text-slate-300">{t('monthly_payment_auto')}</Label>
                <div className="h-9 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white flex items-center">
                  {fmt(monthlyPayment)} so'm
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">{t('start_date')} *</Label>
                <Input type="date" className="bg-slate-800 border-slate-600 text-white" value={loanForm.start_date}
                  onChange={e => setLoanForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-slate-300">{t('end_date_auto')}</Label>
                <div className="h-9 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white flex items-center">
                  {endDate || '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">{t('cash_withdrawal')}</Label>
                <Select value={loanForm.cash_account_id} onValueChange={v => setLoanForm(p => ({ ...p, cash_account_id: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder={t('select_account')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">{t('reason_optional')}</Label>
                <Input className="bg-slate-800 border-slate-600 text-white" value={loanForm.reason}
                  onChange={e => setLoanForm(p => ({ ...p, reason: e.target.value }))} placeholder={t('reason_placeholder')} />
              </div>
            </div>

            {/* Provodka preview */}
            {loanForm.cash_account_id && loanForm.amount && (
              <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm">
                <p className="text-slate-400">{t('accounting_entry')}</p>
                <div className="flex justify-between">
                  <span>Dt 4720 / Kt {accounts.find(a => a.id === loanForm.cash_account_id)?.code || '...'}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">{t('employee_salary')}</span>
                  <span>{fmt(selectedEmployee?.base_salary || 0)} so'm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('after_deduction')}</span>
                  <span className="text-green-400">{fmt((selectedEmployee?.base_salary || 0) - monthlyPayment)} so'm</span>
                </div>
              </div>
            )}

            {/* Payment schedule preview */}
            {paymentPreview.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-2">{t('payment_schedule_preview')}</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">{t('month_col')}</TableHead>
                      <TableHead className="text-slate-400 text-right">{t('payment_col')}</TableHead>
                      <TableHead className="text-slate-400 text-right">{t('balance_col')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentPreview.map((p, i) => (
                      <TableRow key={i} className="border-slate-700">
                        <TableCell className="text-white font-medium">{p.month}</TableCell>
                        <TableCell className="text-white text-right">{fmt(p.payment)}</TableCell>
                        <TableCell className="text-white text-right">{fmt(p.remaining)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parseInt(loanForm.duration_months) > 5 && (
                  <p className="text-center text-slate-500 text-sm mt-1">{t('more_months')} {parseInt(loanForm.duration_months) - 5} {t('months_suffix')}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800">
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateLoan}
              disabled={!loanForm.employee_id || !loanForm.amount || !loanForm.duration_months}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              {t('confirm_send_sms')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
