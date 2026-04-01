import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { User, Wallet, Calendar, Clock, CheckCircle, Briefcase, CreditCard, TrendingDown, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import hrService from '@/api/services/hr';

export default function EmployeePortal() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [profile, setProfile] = useState(null);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileData, payrollData, loanData] = await Promise.allSettled([
        hrService.getMyProfile(),
        hrService.getMyPayrollHistory(),
        hrService.getMyLoan(),
      ]);
      if (profileData.status === 'fulfilled') setProfile(profileData.value);
      if (payrollData.status === 'fulfilled') setPayrollHistory(payrollData.value || []);
      if (loanData.status === 'fulfilled') setLoan(loanData.value);
    } catch (e) {
      console.error('Failed to load portal data:', e);
      setError(t('data_load_failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = (n) => String(Number(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500">{t('loading_dots')}</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-lg">{t('profile_not_found')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('profile_not_linked')}</p>
        </div>
      </div>
    );
  }

  const loanPaidPercent = loan && loan.amount > 0
    ? Math.round(((loan.paid_amount || 0) / loan.amount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg">
            {profile?.first_name?.[0]}{profile?.last_name?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h2>
            <p className="text-slate-400 text-sm">{profile?.position || t('employee_default')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{t('monthly_salary')}</p>
            <p className="text-2xl font-bold text-emerald-400">{fmt(profile?.base_salary)} <span className="text-sm font-normal text-slate-400">so'm</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">{t('position_label')}</p>
              <p className="text-sm">{profile?.position || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">{t('hire_date_label')}</p>
              <p className="text-sm">{profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString('uz-UZ') : '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">{t('id_number_label')}</p>
              <p className="text-sm">{profile?.employee_code || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loan Section - MENING QARZIM */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 pt-5 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white">{t('my_loan')}</h3>
          </div>
        </div>

        {!loan ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-400 font-semibold text-lg">{t('no_active_loan')}</p>
            <p className="text-slate-500 text-sm mt-1">{t('no_loan_description')}</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Loan overview cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <Wallet className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">{t('issued_loan')}</p>
                <p className="text-lg font-bold text-white">{fmt(loan.amount)}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <TrendingDown className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">{t('remaining_loan')}</p>
                <p className="text-lg font-bold text-amber-400">{fmt(loan.remaining_amount)}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">{t('paid_amount')}</p>
                <p className="text-lg font-bold text-emerald-400">{fmt(loan.paid_amount)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">{t('payment_progress')}</span>
                <span className="text-white font-semibold">{loanPaidPercent}% {t('paid_status')}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${loanPaidPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2 text-slate-500">
                <span>{t('monthly_label')} {fmt(loan.monthly_payment)} so'm</span>
                <span>{loan.start_date} — {loan.end_date}</span>
              </div>
            </div>

            {/* Payment schedule */}
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">{t('payment_schedule')}</h4>
              <div className="rounded-xl border border-slate-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800/80 border-slate-700 hover:bg-slate-800/80">
                      <TableHead className="text-slate-400 font-medium">{t('month_col')}</TableHead>
                      <TableHead className="text-slate-400 font-medium text-right">{t('payment_col')}</TableHead>
                      <TableHead className="text-slate-400 font-medium text-right">{t('balance_col')}</TableHead>
                      <TableHead className="text-slate-400 font-medium text-center">{t('status_col')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(loan.payments || []).map(p => (
                      <TableRow key={p.id} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-white font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {p.month_label}
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-right">{fmt(p.amount)} so'm</TableCell>
                        <TableCell className="text-slate-400 text-right">{fmt(p.remaining_after)} so'm</TableCell>
                        <TableCell className="text-center">
                          {p.status === 'paid' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" /> {t('paid_status')}
                            </Badge>
                          ) : p.status === 'overdue' ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              <Clock className="w-3 h-3 mr-1" /> {t('overdue_status')}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-600/30 text-slate-400 border-slate-600/50">
                              <Clock className="w-3 h-3 mr-1" /> {t('pending_status')}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payroll History - ISH HAQI TARIXI */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 pt-5 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">{t('salary_history')}</h3>
          </div>
        </div>

        {payrollHistory.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{t('no_salary_history')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-800/80 border-slate-700 hover:bg-slate-800/80">
                  <TableHead className="text-slate-400 font-medium">{t('period_col')}</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">{t('calculated_col') || 'Hisoblangan'}</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">{t('deductions_col')}</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">{t('net_salary_col')}</TableHead>
                  <TableHead className="text-slate-400 font-medium text-center">{t('status_col')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollHistory.map(entry => {
                  const isExpanded = expandedEntry === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="border-slate-700 hover:bg-slate-800/50 cursor-pointer"
                        onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      >
                        <TableCell className="text-white font-medium">
                          {entry.period_name || entry.pay_date || '—'}
                        </TableCell>
                        <TableCell className="text-white text-right">{fmt(entry.gross_salary)}</TableCell>
                        <TableCell className="text-red-400 text-right">-{fmt(entry.total_deductions || 0)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-white font-semibold">{fmt(entry.net_salary)}</span>
                          <span className="text-slate-500 text-xs ml-1">so'm</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.status === 'paid' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" /> {t('paid_salary_status')}
                            </Badge>
                          ) : entry.status === 'approved' ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {t('approved_salary_status')}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-600/30 text-slate-400 border-slate-600/50">
                              {entry.status === 'draft' ? t('draft_status') : entry.status === 'calculated' ? t('calculated_status') : entry.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow className="border-slate-700 bg-slate-800/70">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-4">
                              <p className="text-sm font-semibold text-slate-300 mb-3">
                                {entry.period_name} — {t('payroll_detail') || 'Ish haqi tafsiloti'}
                              </p>
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm max-w-lg">
                                {/* Left: accruals */}
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">{t('base_salary_col') || 'Asosiy ish haqi'}</span>
                                    <span className="text-white">{fmt(entry.base_salary)}</span>
                                  </div>
                                  {(entry.overtime_amount > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('overtime_col') || 'Overtime'}</span>
                                      <span className="text-emerald-400">+{fmt(entry.overtime_amount)}</span>
                                    </div>
                                  )}
                                  {((entry.bonus || 0) + (entry.allowances || 0) > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('bonuses_col') || "Qo'shimcha"}</span>
                                      <span className="text-emerald-400">+{fmt((entry.bonus || 0) + (entry.allowances || 0))}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-slate-600 pt-2">
                                    <span className="text-slate-300 font-medium">{t('gross_salary_label') || 'Jami hisoblangan'}</span>
                                    <span className="text-white font-semibold">{fmt(entry.gross_salary)}</span>
                                  </div>
                                </div>

                                {/* Right: deductions */}
                                <div className="space-y-2">
                                  {(entry.income_tax > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('income_tax_label') || 'Soliq (НДФЛ)'}</span>
                                      <span className="text-red-400">-{fmt(entry.income_tax)}</span>
                                    </div>
                                  )}
                                  {(entry.social_security > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('social_security_label') || 'Ijtimoiy sug\'urta'}</span>
                                      <span className="text-red-400">-{fmt(entry.social_security)}</span>
                                    </div>
                                  )}
                                  {(entry.pension > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('pension_label') || 'Pensiya'}</span>
                                      <span className="text-red-400">-{fmt(entry.pension)}</span>
                                    </div>
                                  )}
                                  {(entry.loan_deduction > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('loan_deduction_label') || 'Qarz ushildi'}</span>
                                      <span className="text-red-400">-{fmt(entry.loan_deduction)}</span>
                                    </div>
                                  )}
                                  {(entry.other_deductions > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t('other_deductions_label') || 'Boshqa ushlanmalar'}</span>
                                      <span className="text-red-400">-{fmt(entry.other_deductions)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-slate-600 pt-2">
                                    <span className="text-emerald-300 font-bold">{t('net_salary_label') || "QO'LGA OLDI"}</span>
                                    <span className="text-emerald-400 font-bold text-base">{fmt(entry.net_salary)} so'm</span>
                                  </div>
                                  {entry.pay_date && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">{t('pay_date_label') || 'Sana'}</span>
                                      <span className="text-slate-400">{entry.pay_date}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
