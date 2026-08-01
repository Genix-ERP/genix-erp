import React, { useState, useEffect } from 'react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Crown, Sparkles, Users,
  Minus, Plus, CreditCard, Loader2, AlertTriangle, CheckCircle, XCircle, Clock
} from 'lucide-react';
import subscriptionService from '@/api/services/subscription';
import { formatDate } from '@/utils/formatDate';

export default function SubscriptionSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    subscription, aiUsage, trialStatus,
    getPlanLimits, getRemainingAIRequests, getAIUsagePercentage, getTrialDaysRemaining,
  } = useSubscription();

  const [pricing, setPricing] = useState({ price_per_user_monthly: 199000, price_per_user_yearly: 169000 });
  const [users, setUsers] = useState(1);
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [verifying, setVerifying] = useState(false);

  const loadPayments = () =>
    subscriptionService.getPayments().then((data) => {
      if (Array.isArray(data)) setPayments(data);
    }).catch(() => {});

  useEffect(() => {
    subscriptionService.getPlans().then((data) => {
      if (data?.price_per_user_monthly) setPricing(data);
    }).catch(() => {});
    loadPayments();
  }, []);

  const handleVerifyPayment = async (invoiceId) => {
    setVerifying(true);
    try {
      const result = await subscriptionService.verifyPayment(invoiceId);
      await loadPayments();
      if (result?.status === 'success') {
        window.location.reload();
      }
    } catch (e) {
      // silent
    } finally {
      setVerifying(false);
    }
  };

  const currentLimits = getPlanLimits();
  const aiRemaining = getRemainingAIRequests();
  const aiPercentage = getAIUsagePercentage();
  const trialDays = getTrialDaysRemaining();

  const pricePerUser = billing === 'yearly' ? pricing.price_per_user_yearly : pricing.price_per_user_monthly;
  const total = billing === 'yearly' ? pricePerUser * 12 * users : pricePerUser * users;

  const fmt = (n) => n?.toLocaleString('uz-UZ');
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return formatDate(dt);
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionService.createCheckout(users, billing);
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Status */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[var(--genix-blue)]/10 to-[var(--genix-purple)]/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              {t('current_subscription')}
            </CardTitle>
            <Badge className={`px-3 py-1 ${trialStatus?.status === 'active' ? 'bg-green-500 hover:bg-green-500' : ''}`}>
              {trialStatus?.status === 'active'
                ? (language === 'uz' ? 'Faol' : language === 'ru' ? 'Активный' : 'Active')
                : trialStatus?.status === 'trialing' || subscription?.status === 'trialing'
                  ? (t('trial_period') || 'Sinov')
                  : (trialStatus?.status || subscription?.plan || 'Free Trial')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {subscription?.status === 'trialing' && trialDays > 0 && (
            <div className={`flex items-start gap-3 p-4 rounded-lg mb-6 ${
              trialDays <= 3 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${trialDays <= 3 ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <p className={`font-medium ${trialDays <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
                  {t('trial_period')}: {trialDays} {t('days_remaining')}
                </p>
                <p className="text-sm text-slate-600 mt-1">{t('trial_end_warning')}</p>
              </div>
            </div>
          )}

          {(() => {
            const lastPaid = payments.find(p => p.status === 'success');
            let nextPaymentDate = null;
            if (lastPaid) {
              const d = new Date(lastPaid.paid_at || lastPaid.created_at);
              const planStr = lastPaid.plan || '';
              if (planStr.includes('yearly')) d.setFullYear(d.getFullYear() + 1);
              else d.setMonth(d.getMonth() + 1);
              nextPaymentDate = d;
            }
            return (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">{t('ai_requests')}</span>
                  </div>
                  {currentLimits.aiRequestsPerMonth === -1 ? (
                    <p className="text-2xl font-bold text-green-600">{t('unlimited')}</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-slate-900">{aiUsage.count} / {currentLimits.aiRequestsPerMonth}</p>
                      <Progress value={aiPercentage} className="h-2" />
                      <p className="text-xs text-slate-500">{aiRemaining} {t('requests_remaining')}</p>
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{t('users')}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {subscription?.currentUsers || 1} / {trialStatus?.paid_users || subscription?.paid_users || currentLimits.maxUsers || '∞'}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium">
                      {language === 'uz' ? 'Keyingi to\'lov' : language === 'ru' ? 'Следующий платёж' : 'Next payment'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {nextPaymentDate ? fmtDate(nextPaymentDate) : '—'}
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Purchase / Upgrade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            {t('available_plans') || "To'lov"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Billing toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {[
              { key: 'monthly', label: language === 'uz' ? 'Oylik' : language === 'ru' ? 'Ежемесячно' : 'Monthly' },
              { key: 'yearly',  label: language === 'uz' ? 'Yillik' : language === 'ru' ? 'Ежегодно' : 'Yearly' },
            ].map((b) => (
              <button
                key={b.key}
                onClick={() => setBilling(b.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  billing === b.key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {b.label}
                {b.key === 'yearly' && (
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {language === 'uz' ? '15% tejash' : language === 'ru' ? 'Экономия 15%' : 'Save 15%'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Pricing display */}
          <div className="text-center py-2">
            <span className="text-4xl font-bold text-slate-900">{fmt(pricePerUser)}</span>
            <span className="text-slate-500 ml-1">
              UZS {language === 'uz' ? '/foydalanuvchi/oy' : language === 'ru' ? '/польз./мес' : '/user/month'}
            </span>
            {billing === 'yearly' && (
              <p className="text-sm text-slate-500 mt-1">
                ({fmt(pricing.price_per_user_monthly)} → {fmt(pricing.price_per_user_yearly)}{' '}
                {language === 'uz' ? 'yillik to\'lovda' : language === 'ru' ? 'при оплате за год' : 'when billed yearly'})
              </p>
            )}
          </div>

          {/* User count selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              {language === 'uz' ? 'Foydalanuvchilar soni' : language === 'ru' ? 'Количество пользователей' : 'Number of users'}
            </label>
            <p className="text-xs text-slate-400">
              {language === 'uz' ? '1 egasi + qolgan xodimlar (masalan, 4 ta xarisangiz — 3 ta xodim qo\'sha olasiz)' :
               language === 'ru' ? '1 владелец + остальные сотрудники' :
               '1 owner + remaining employees (e.g. buying 4 lets you add 3 employees)'}
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setUsers(u => Math.max(1, u - 1))}
                className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-3xl font-bold text-slate-900 min-w-[3rem] text-center">{users}</span>
              <button
                onClick={() => setUsers(u => u + 1)}
                className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold text-slate-900">{fmt(total)} UZS</div>
                <div className="text-xs text-slate-500">
                  {billing === 'yearly'
                    ? (language === 'uz' ? 'yillik to\'lov' : language === 'ru' ? 'в год' : 'per year')
                    : (language === 'uz' ? 'oylik to\'lov' : language === 'ru' ? 'в месяц' : 'per month')
                  }
                </div>
              </div>
            </div>
          </div>

          {/* If there's a recent pending payment, show a verify button */}
          {payments.filter(p => p.status === 'pending').slice(0, 1).map(p => (
            <div key={p.invoice_id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                {language === 'uz' ? 'Kutilayotgan to\'lov mavjud' : language === 'ru' ? 'Есть незавершённый платёж' : 'Pending payment found'}
              </p>
              <button
                onClick={() => handleVerifyPayment(p.invoice_id)}
                disabled={verifying}
                className="text-sm font-semibold text-amber-700 underline flex items-center gap-1"
              >
                {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {language === 'uz' ? 'Tekshirish' : language === 'ru' ? 'Проверить' : 'Check status'}
              </button>
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 text-white h-12 text-base font-semibold"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'uz' ? "Yo'naltirilmoqda..." : 'Redirecting...'}</>
              : <><CreditCard className="w-4 h-4 mr-2" />{language === 'uz' ? "To'lov qilish" : language === 'ru' ? 'Оплатить' : 'Pay now'}</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Payment history — only successful payments */}
      {payments.filter(p => p.status === 'success').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              {language === 'uz' ? "To'lov tarixi" : language === 'ru' ? 'История платежей' : 'Payment history'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {payments.filter(p => p.status === 'success').map((p) => {
                const date = p.paid_at || p.created_at;
                let usersCount = 1;
                let billingType = 'monthly';
                const match = (p.plan || '').match(/^(\d+)users_(.+)$/);
                if (match) { usersCount = parseInt(match[1]); billingType = match[2]; }
                return (
                  <div key={p.invoice_id} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {usersCount} {language === 'uz' ? 'foydalanuvchi' : language === 'ru' ? 'пользов.' : 'user(s)'} ·{' '}
                          {billingType === 'yearly'
                            ? (language === 'uz' ? 'Yillik' : language === 'ru' ? 'Годовой' : 'Yearly')
                            : (language === 'uz' ? 'Oylik' : language === 'ru' ? 'Месячный' : 'Monthly')}
                        </p>
                        <p className="text-xs text-slate-400">{fmtDate(date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{fmt(p.amount_uzs)} UZS</p>
                      <Badge className="text-xs mt-1 bg-green-100 text-green-700 hover:bg-green-100">
                        {language === 'uz' ? 'To\'langan' : language === 'ru' ? 'Оплачено' : 'Paid'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
