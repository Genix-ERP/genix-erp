import { useState, useEffect } from 'react';
import { CreditCard, Lock, AlertTriangle, Minus, Plus, Loader2, Phone, Mail } from 'lucide-react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import subscriptionService from '@/api/services/subscription';

const T = {
  title:         { uz: 'Sinov muddati tugadi', ru: 'Пробный период истёк', en: 'Your trial has ended' },
  subtitle:      { uz: "Genix ERP'dan foydalanishda davom etish uchun to'lov qiling.", ru: 'Оплатите для продолжения работы с Genix ERP.', en: 'Pay to continue using Genix ERP.' },
  days_warning:  { uz: (d) => `Hisob ${d} kunda o'chiriladi`, ru: (d) => `Аккаунт удалят через ${d} дней`, en: (d) => `Account deleted in ${d} day${d===1?'':'s'}` },
  users_label:   { uz: 'Foydalanuvchilar soni', ru: 'Количество пользователей', en: 'Number of users' },
  users_hint:    { uz: '1 egasi + qolgan xodimlar', ru: '1 владелец + остальные сотрудники', en: '1 owner + remaining employees' },
  monthly:       { uz: 'Oylik', ru: 'Ежемесячно', en: 'Monthly' },
  yearly:        { uz: 'Yillik', ru: 'Ежегодно', en: 'Yearly' },
  yearly_save:   { uz: "15% tejash", ru: 'Экономия 15%', en: 'Save 15%' },
  per_user_month:{ uz: '/foydalanuvchi/oy', ru: '/пользователь/мес', en: '/user/month' },
  total:         { uz: 'Jami', ru: 'Итого', en: 'Total' },
  billed_yearly: { uz: 'yillik to\'lov', ru: 'в год', en: 'billed yearly' },
  billed_monthly:{ uz: 'oylik to\'lov', ru: 'в месяц', en: 'per month' },
  pay:           { uz: "To'lov qilish", ru: 'Оплатить', en: 'Pay now' },
  redirecting:   { uz: "Yo'naltirilmoqda...", ru: 'Перенаправление...', en: 'Redirecting...' },
  contact_info:  { uz: "Savol yoki to'lov uchun:", ru: 'По вопросам оплаты:', en: 'Questions or payment help:' },
  logout:        { uz: 'Chiqish', ru: 'Выйти', en: 'Log out' },
  close:         { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
};

const tr = (key, lang, arg) => {
  const e = T[key]?.[lang] || T[key]?.en;
  if (!e) return key;
  return typeof e === 'function' ? e(arg) : e;
};

function fmt(n) { return n?.toLocaleString('uz-UZ') ?? n; }

export default function PaymentWall({ visible = false, onClose }) {
  const { trialStatus, isSystemAdmin } = useSubscription();
  const { logout } = useAuth();
  const { language } = useLanguage();

  const [pricing, setPricing] = useState({ price_per_user_monthly: 199000, price_per_user_yearly: 169000 });
  const [users, setUsers] = useState(1);
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    subscriptionService.getPlans().then((data) => {
      if (data?.price_per_user_monthly) setPricing(data);
    }).catch(() => {});
  }, []);

  if (!trialStatus || isSystemAdmin) return null;

  const { status, days_until_clear: daysClear } = trialStatus;
  const isHardBlock = status === 'past_due' || status === 'expired';
  if (!isHardBlock && !visible) return null;

  const pricePerUser = billing === 'yearly' ? pricing.price_per_user_yearly : pricing.price_per_user_monthly;
  const total = billing === 'yearly' ? pricePerUser * 12 * users : pricePerUser * users;

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionService.createCheckout(users, billing);
      window.open(data.checkout_url, '_blank');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.92)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        maxWidth: 480, width: '100%',
        padding: '2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', marginBottom: '0.75rem',
          }}>
            <Lock style={{ width: 22, height: 22, color: '#dc2626' }} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {tr('title', language)}
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.4rem', fontSize: '0.9rem' }}>
            {tr('subtitle', language)}
          </p>
          {daysClear !== undefined && daysClear > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: '0.5rem', padding: '0.3rem 0.75rem',
              background: '#fef2f2', borderRadius: 8, color: '#991b1b', fontSize: '0.8rem', fontWeight: 500,
            }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              {tr('days_warning', language, daysClear)}
            </div>
          )}
        </div>

        {/* Billing toggle */}
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: 10,
          padding: 4, marginBottom: '1.25rem', gap: 4,
        }}>
          {['monthly', 'yearly'].map((b) => (
            <button key={b} onClick={() => setBilling(b)} style={{
              flex: 1, padding: '0.5rem', border: 'none', borderRadius: 7,
              background: billing === b ? '#fff' : 'transparent',
              boxShadow: billing === b ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              fontWeight: 600, fontSize: '0.875rem',
              color: billing === b ? '#0f172a' : '#64748b',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {tr(b, language)}
              {b === 'yearly' && (
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
                  {tr('yearly_save', language)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User count */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            {tr('users_label', language)}
          </label>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 8 }}>
            {tr('users_hint', language)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setUsers(u => Math.max(1, u - 1))} style={{
              width: 36, height: 36, border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Minus style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'center' }}>
              {users}
            </span>
            <button onClick={() => setUsers(u => u + 1)} style={{
              width: 36, height: 36, border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus style={{ width: 16, height: 16 }} />
            </button>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {fmt(pricePerUser)} UZS{tr('per_user_month', language)}
              </div>
            </div>
          </div>
        </div>

        {/* Total */}
        <div style={{
          background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
          borderRadius: 12, padding: '1rem 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1rem', color: '#fff',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{tr('total', language)}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{fmt(total)} UZS</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>
              {billing === 'yearly' ? tr('billed_yearly', language) : tr('billed_monthly', language)}
            </div>
          </div>
          <button
            onClick={handlePay}
            disabled={loading}
            style={{
              background: '#fff', color: '#7c3aed',
              border: 'none', borderRadius: 10,
              padding: '0.6rem 1.25rem',
              fontWeight: 700, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />{tr('redirecting', language)}</>
              : <><CreditCard style={{ width: 15, height: 15 }} />{tr('pay', language)}</>
            }
          </button>
        </div>

        {error && (
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {/* Contact */}
        <div style={{
          background: '#f8fafc', borderRadius: 10, padding: '0.75rem 1rem',
          display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '0.75rem',
        }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{tr('contact_info', language)}</span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="tel:+998781234567" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0EA5E9', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
              <Phone style={{ width: 12, height: 12 }} />+998 78 123 45 67
            </a>
            <a href="mailto:sales@genixerp.com" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0EA5E9', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
              <Mail style={{ width: 12, height: 12 }} />sales@genixerp.com
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          {!isHardBlock && onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              {tr('close', language)}
            </button>
          )}
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
            {tr('logout', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
