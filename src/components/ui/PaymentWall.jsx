import { useState } from 'react';
import { CreditCard, Lock, AlertTriangle, CheckCircle, Phone, Mail } from 'lucide-react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';

const T = {
  title: {
    uz: 'Sinov muddati tugadi',
    ru: 'Пробный период истёк',
    en: 'Your trial has ended',
  },
  subtitle: {
    uz: 'Genix ERP\'dan foydalanishda davom etish uchun tarifni tanlang.',
    ru: 'Выберите тарифный план для продолжения работы с Genix ERP.',
    en: 'Choose a plan to continue using Genix ERP.',
  },
  days_warning: {
    uz: (d) => `Diqqat: hisob ${d} kunda o'chiriladi.`,
    ru: (d) => `Внимание: аккаунт будет удалён через ${d} дней.`,
    en: (d) => `Warning: your account will be deleted in ${d} day${d === 1 ? '' : 's'}.`,
  },
  contact_sales: {
    uz: 'Sotuvchilar bilan bog\'lanish',
    ru: 'Связаться с отделом продаж',
    en: 'Contact sales',
  },
  logout: { uz: 'Chiqish', ru: 'Выйти', en: 'Log out' },
  per_month: { uz: '/oy', ru: '/мес', en: '/mo' },
  most_popular: { uz: 'Mashhur', ru: 'Популярный', en: 'Most popular' },
  select: { uz: 'Tanlash', ru: 'Выбрать', en: 'Select' },
  activating: { uz: 'Faollashtirish...', ru: 'Активация...', en: 'Activating...' },
  success: { uz: 'Muvaffaqiyatli! Yuklanmoqda...', ru: 'Успешно! Загрузка...', en: 'Success! Loading...' },
  contact_info: {
    uz: 'To\'lov yoki savollar bo\'yicha biz bilan bog\'laning:',
    ru: 'По вопросам оплаты свяжитесь с нами:',
    en: 'For payment or questions, contact us:',
  },
};

const tr = (key, lang, arg) => {
  const entry = T[key]?.[lang] || T[key]?.en;
  if (!entry) return key;
  return typeof entry === 'function' ? entry(arg) : entry;
};

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 299,
    users: '1-10',
    features: ['Barcha asosiy modullar', 'Email yordam', '5 GB saqlash', '10 foydalanuvchi'],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 499,
    users: '1-50',
    popular: true,
    features: ['Barcha modullar', 'Ustun yordam', '50 GB saqlash', '50 foydalanuvchi', 'Kengaytirilgan AI'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 999,
    users: 'Cheksiz',
    features: ['Barcha modullar', '24/7 Premium yordam', 'Cheksiz saqlash', 'Cheksiz foydalanuvchi', 'White-label'],
  },
];

// visible = force open (e.g. from TrialBanner "Pay Now" click)
// onClose = callback to close when forced open (otherwise wall stays until payment)
export default function PaymentWall({ visible = false, onClose }) {
  const { trialStatus, activateSubscription, isSystemAdmin } = useSubscription();
  const { logout } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!trialStatus || isSystemAdmin) return null;
  const { status, days_until_clear: daysClear } = trialStatus;

  const isHardBlock = status === 'past_due' || status === 'expired';
  // Show if hard block OR if explicitly opened from "Pay Now"
  if (!isHardBlock && !visible) return null;

  const handleSelect = async (planKey) => {
    setLoading(planKey);
    setError('');
    const result = await activateSubscription(planKey);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setError(result.error);
      setLoading(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.92)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          maxWidth: 860,
          width: '100%',
          padding: '2.5rem 2rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              style={{
                border: plan.popular ? '2px solid #0EA5E9' : '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '1.25rem',
                position: 'relative',
                background: plan.popular ? '#f0f9ff' : '#fff',
              }}
            >
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
              <div style={{ margin: '0.5rem 0', color: '#0EA5E9', fontWeight: 800, fontSize: '1.375rem' }}>
                ${plan.price}<span style={{ fontSize: '0.8125rem', fontWeight: 400, color: '#64748b' }}>{tr('per_month', language)}</span>
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
                onClick={() => handleSelect(plan.key)}
                disabled={!!loading || success}
                style={{
                  width: '100%', height: 38, border: 'none', borderRadius: 8,
                  background: plan.popular ? 'linear-gradient(135deg,#0EA5E9,#8B5CF6)' : '#0f172a',
                  color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                  cursor: loading || success ? 'not-allowed' : 'pointer',
                  opacity: loading && loading !== plan.key ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {success && loading === plan.key
                  ? tr('success', language)
                  : loading === plan.key
                    ? tr('activating', language)
                    : <><CreditCard style={{ width: 14, height: 14 }} />{tr('select', language)}</>
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

        {/* Contact info */}
        <div style={{
          background: '#f8fafc', borderRadius: 12, padding: '1rem 1.25rem',
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

        {/* Footer actions */}
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          {!isHardBlock && onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}
            >
              ✕ Close
            </button>
          )}
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            {tr('logout', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
