import { useState, useEffect } from 'react';
import { CreditCard, Lock, AlertTriangle, CheckCircle, Phone, Mail, Loader2 } from 'lucide-react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import subscriptionService from '@/api/services/subscription';

const T = {
  title:    { uz: 'Sinov muddati tugadi', ru: 'Пробный период истёк', en: 'Your trial has ended' },
  subtitle: { uz: 'Genix ERP\'dan foydalanishda davom etish uchun tarifni tanlang.', ru: 'Выберите тариф для продолжения работы.', en: 'Choose a plan to continue using Genix ERP.' },
  days_warning: { uz: (d) => `Hisob ${d} kunda o'chiriladi`, ru: (d) => `Аккаунт удалят через ${d} дней`, en: (d) => `Account deleted in ${d} day${d===1?'':'s'}` },
  per_month:    { uz: '/oy', ru: '/мес', en: '/mo' },
  most_popular: { uz: 'Mashhur', ru: 'Популярный', en: 'Most popular' },
  pay:          { uz: 'To\'lov qilish', ru: 'Оплатить', en: 'Pay now' },
  redirecting:  { uz: 'Yo\'naltirilmoqda...', ru: 'Перенаправление...', en: 'Redirecting...' },
  contact_info: { uz: 'Savol yoki to\'lov uchun:', ru: 'По вопросам оплаты:', en: 'Questions or payment help:' },
  logout:       { uz: 'Chiqish', ru: 'Выйти', en: 'Log out' },
  close:        { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
  per_month_label: { uz: '/oy', ru: '/мес', en: '/mo' },
};

const tr = (key, lang, arg) => {
  const e = T[key]?.[lang] || T[key]?.en;
  if (!e) return key;
  return typeof e === 'function' ? e(arg) : e;
};

const DEFAULT_PLANS = [
  { key: 'starter',      name: 'Starter',      amountUZS: 299000, popular: false,
    features: ['Barcha asosiy modullar', 'Email yordam', '5 GB saqlash', '10 foydalanuvchi'] },
  { key: 'professional', name: 'Professional',  amountUZS: 499000, popular: true,
    features: ['Barcha modullar', 'Ustun yordam', '50 GB saqlash', '50 foydalanuvchi', 'Kengaytirilgan AI'] },
  { key: 'enterprise',   name: 'Enterprise',    amountUZS: 999000, popular: false,
    features: ['Barcha modullar', '24/7 yordam', 'Cheksiz saqlash', 'Cheksiz foydalanuvchi', 'White-label'] },
];

function fmt(n) {
  return n?.toLocaleString('uz-UZ') ?? n;
}

export default function PaymentWall({ visible = false, onClose }) {
  const { trialStatus, isSystemAdmin } = useSubscription();
  const { logout } = useAuth();
  const { language } = useLanguage();

  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  // Fetch real prices from backend
  useEffect(() => {
    subscriptionService.getPlans().then((data) => {
      if (!data) return;
      setPlans(DEFAULT_PLANS.map((p) => {
        const found = data.find((d) => d.key === p.key);
        return found ? { ...p, amountUZS: found.amount_uzs } : p;
      }));
    }).catch(() => {});
  }, []);

  if (!trialStatus || isSystemAdmin) return null;

  const { status, days_until_clear: daysClear } = trialStatus;
  const isHardBlock = status === 'past_due' || status === 'expired';
  if (!isHardBlock && !visible) return null;

  const handlePay = async (planKey) => {
    setLoading(planKey);
    setError('');
    try {
      const data = await subscriptionService.createCheckout(planKey);
      // Redirect to Multicard payment page
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Payment failed');
      setLoading(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.92)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', overflow: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        maxWidth: 880, width: '100%',
        padding: '2.5rem 2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', marginBottom: '1rem',
          }}>
            <Lock style={{ width: 24, height: 24, color: '#dc2626' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {tr('title', language)}
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.9375rem' }}>
            {tr('subtitle', language)}
          </p>
          {daysClear !== undefined && daysClear > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: '0.75rem', padding: '0.375rem 0.875rem',
              background: '#fef2f2', borderRadius: 8, color: '#991b1b', fontSize: '0.8125rem', fontWeight: 500,
            }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />
              {tr('days_warning', language, daysClear)}
            </div>
          )}
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {plans.map((plan) => (
            <div key={plan.key} style={{
              border: plan.popular ? '2px solid #0EA5E9' : '1px solid #e2e8f0',
              borderRadius: 14, padding: '1.25rem', position: 'relative',
              background: plan.popular ? '#f0f9ff' : '#fff',
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: '#0EA5E9', color: '#fff', fontSize: '0.6875rem', fontWeight: 700,
                  padding: '2px 12px', borderRadius: 20,
                }}>
                  {tr('most_popular', language)}
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{plan.name}</div>
              <div style={{ margin: '0.5rem 0', fontWeight: 800, fontSize: '1.25rem', color: '#0EA5E9' }}>
                {fmt(plan.amountUZS)}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>
                  UZS{tr('per_month', language)}
                </span>
              </div>
              <ul style={{ padding: 0, margin: '0.75rem 0 1rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#475569' }}>
                    <CheckCircle style={{ width: 13, height: 13, color: '#22c55e', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handlePay(plan.key)}
                disabled={!!loading}
                style={{
                  width: '100%', height: 40, border: 'none', borderRadius: 8,
                  background: plan.popular ? 'linear-gradient(135deg,#0EA5E9,#8B5CF6)' : '#0f172a',
                  color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading && loading !== plan.key ? 0.45 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'opacity 0.2s',
                }}
              >
                {loading === plan.key
                  ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />{tr('redirecting', language)}</>
                  : <><CreditCard style={{ width: 14, height: 14 }} />{tr('pay', language)}</>
                }
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Contact */}
        <div style={{
          background: '#f8fafc', borderRadius: 12, padding: '0.875rem 1.25rem',
          display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>{tr('contact_info', language)}</span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="tel:+998781234567" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0EA5E9', fontSize: '0.8125rem', textDecoration: 'none', fontWeight: 500 }}>
              <Phone style={{ width: 13, height: 13 }} />+998 78 123 45 67
            </a>
            <a href="mailto:sales@genixerp.com" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0EA5E9', fontSize: '0.8125rem', textDecoration: 'none', fontWeight: 500 }}>
              <Mail style={{ width: 13, height: 13 }} />sales@genixerp.com
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          {!isHardBlock && onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>
              {tr('close', language)}
            </button>
          )}
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}>
            {tr('logout', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
