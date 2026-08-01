import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Wallet, Calendar, Clock, CheckCircle, Briefcase, CreditCard, TrendingDown, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import hrService from '@/api/services/hr';
import { formatDate } from '@/utils/formatDate';

export default function EmployeePortal() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

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
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] p-6 text-white">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-bold shadow-lg">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h2>
              <p className="text-white/80 text-sm">{profile?.position || t('employee_default')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">{t('monthly_salary')}</p>
              <p className="text-2xl font-bold">{formatCurrency(profile?.base_salary)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">{t('position_label')}</p>
              <p className="text-sm text-slate-900">{profile?.position || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">{t('hire_date_label')}</p>
              <p className="text-sm text-slate-900">{profile?.hire_date ? formatDate(profile.hire_date) : '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">{t('id_number_label')}</p>
              <p className="text-sm text-slate-900">{profile?.employee_code || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loan Section - MENING QARZIM */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 pt-5 pb-4 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('my_loan')}</h3>
          </div>
        </div>

        {!loan ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-green-600 font-semibold text-lg">{t('no_active_loan')}</p>
            <p className="text-slate-500 text-sm mt-1">{t('no_loan_description')}</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Loan overview cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <Wallet className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-slate-500">{t('issued_loan')}</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(loan.amount)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <TrendingDown className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-xs text-slate-500">{t('remaining_loan')}</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(loan.remaining_amount)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-slate-500">{t('paid_amount')}</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(loan.paid_amount)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">{t('payment_progress')}</span>
                <span className="text-slate-900 font-semibold">{loanPaidPercent}% {t('paid_status')}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${loanPaidPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2 text-slate-500">
                <span>{t('monthly_label')} {formatCurrency(loan.monthly_payment)}</span>
                <span>{formatDate(loan.start_date)} — {formatDate(loan.end_date)}</span>
              </div>
            </div>

            {/* Payment schedule */}
            <div>
              <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">{t('payment_schedule')}</h4>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200 hover:bg-slate-50">
                      <TableHead className="text-slate-500 font-medium">{t('month_col')}</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">{t('payment_col')}</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">{t('balance_col')}</TableHead>
                      <TableHead className="text-slate-500 font-medium text-center">{t('status_col')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(loan.payments || []).map(p => (
                      <TableRow key={p.id} className="border-slate-200 hover:bg-slate-50">
                        <TableCell className="text-slate-900 font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {p.month_label}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-900 text-right">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-slate-500 text-right">{formatCurrency(p.remaining_after)}</TableCell>
                        <TableCell className="text-center">
                          {p.status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" /> {t('paid_status')}
                            </Badge>
                          ) : p.status === 'overdue' ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <Clock className="w-3 h-3 mr-1" /> {t('overdue_status')}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
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
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 pt-5 pb-4 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('salary_history')}</h3>
          </div>
        </div>

        {payrollHistory.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{t('no_salary_history')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-slate-200 hover:bg-slate-50">
                  <TableHead className="text-slate-500 font-medium">{t('period_col')}</TableHead>
                  <TableHead className="text-slate-500 font-medium text-right">{t('calculated_col') || 'Hisoblangan'}</TableHead>
                  <TableHead className="text-slate-500 font-medium text-right">{t('deductions_col')}</TableHead>
                  <TableHead className="text-slate-500 font-medium text-right">{t('net_salary_col')}</TableHead>
                  <TableHead className="text-slate-500 font-medium text-center">{t('status_col')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollHistory.map(entry => {
                  const isExpanded = expandedEntry === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      >
                        <TableCell className="text-slate-900 font-medium">
                          {entry.period_name || entry.pay_date || '—'}
                        </TableCell>
                        <TableCell className="text-slate-900 text-right">{formatCurrency(entry.gross_salary)}</TableCell>
                        <TableCell className="text-red-600 text-right">-{formatCurrency(entry.total_deductions || 0)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-slate-900 font-semibold">{formatCurrency(entry.net_salary)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" /> {t('paid_salary_status')}
                            </Badge>
                          ) : entry.status === 'approved' ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              {t('approved_salary_status')}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
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
                        <TableRow className="border-slate-200 bg-slate-50">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-4">
                              <p className="text-sm font-semibold text-slate-700 mb-3">
                                {entry.period_name} — {t('payroll_detail') || 'Ish haqi tafsiloti'}
                              </p>
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm max-w-lg">
                                {/* Left: accruals */}
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{t('base_salary_col') || 'Asosiy ish haqi'}</span>
                                    <span className="text-slate-900">{formatCurrency(entry.base_salary)}</span>
                                  </div>
                                  {(entry.overtime_amount > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('overtime_col') || 'Overtime'}</span>
                                      <span className="text-green-600">+{formatCurrency(entry.overtime_amount)}</span>
                                    </div>
                                  )}
                                  {((entry.bonus || 0) + (entry.allowances || 0) > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('bonuses_col') || "Qo'shimcha"}</span>
                                      <span className="text-green-600">+{formatCurrency((entry.bonus || 0) + (entry.allowances || 0))}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-slate-200 pt-2">
                                    <span className="text-slate-700 font-medium">{t('gross_salary_label') || 'Jami hisoblangan'}</span>
                                    <span className="text-slate-900 font-semibold">{formatCurrency(entry.gross_salary)}</span>
                                  </div>
                                </div>

                                {/* Right: deductions */}
                                <div className="space-y-2">
                                  {(entry.income_tax > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('income_tax_label') || 'Soliq (НДФЛ)'}</span>
                                      <span className="text-red-600">-{formatCurrency(entry.income_tax)}</span>
                                    </div>
                                  )}
                                  {(entry.social_security > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('social_security_label') || 'Ijtimoiy sug\'urta'}</span>
                                      <span className="text-red-600">-{formatCurrency(entry.social_security)}</span>
                                    </div>
                                  )}
                                  {(entry.pension > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('pension_label') || 'Pensiya'}</span>
                                      <span className="text-red-600">-{formatCurrency(entry.pension)}</span>
                                    </div>
                                  )}
                                  {(entry.loan_deduction > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('loan_deduction_label') || 'Qarz ushildi'}</span>
                                      <span className="text-red-600">-{formatCurrency(entry.loan_deduction)}</span>
                                    </div>
                                  )}
                                  {(entry.other_deductions > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">{t('other_deductions_label') || 'Boshqa ushlanmalar'}</span>
                                      <span className="text-red-600">-{formatCurrency(entry.other_deductions)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-slate-200 pt-2">
                                    <span className="text-green-700 font-bold">{t('net_salary_label') || "QO'LGA OLDI"}</span>
                                    <span className="text-green-600 font-bold text-base">{formatCurrency(entry.net_salary)}</span>
                                  </div>
                                  {entry.pay_date && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">{t('pay_date_label') || 'Sana'}</span>
                                      <span className="text-slate-500">{formatDate(entry.pay_date)}</span>
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
