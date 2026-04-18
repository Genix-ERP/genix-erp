import { useState } from 'react';
import { AlertTriangle, X, CreditCard, Clock } from 'lucide-react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useLanguage } from '@/components/contexts/LanguageContext';

const T = {
  trial_active: {
    uz: (d) => `Sinov muddati: ${d} kun qoldi`,
    ru: (d) => `Пробный период: осталось ${d} дней`,
    en: (d) => `Free trial: ${d} day${d === 1 ? '' : 's'} remaining`,
  },
  trial_expired: {
    uz: 'Sinov muddati tugadi. Hisob-kitob qiling yoki funksiyalar bloklansiz.',
    ru: 'Пробный период истёк. Оплатите или функции будут заблокированы.',
    en: 'Your trial has ended. Please pay to keep using Genix.',
  },
  days_until_clear: {
    uz: (d) => `Hisob ${d} kunda o'chiriladi`,
    ru: (d) => `Аккаунт будет удалён через ${d} дней`,
    en: (d) => `Account will be deleted in ${d} day${d === 1 ? '' : 's'}`,
  },
  pay_now: { uz: 'To\'lov qilish', ru: 'Оплатить', en: 'Pay now' },
  dismiss: { uz: 'Yopish', ru: 'Закрыть', en: 'Dismiss' },
};

const tr = (key, lang, arg) => {
  const entry = T[key]?.[lang] || T[key]?.en;
  if (!entry) return key;
  return typeof entry === 'function' ? entry(arg) : entry;
};

export default function TrialBanner({ onPayClick }) {
  const { trialStatus, isSystemAdmin } = useSubscription();
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  // Don't show for system admins or if no backend data
  if (!trialStatus || isSystemAdmin || dismissed) return null;

  const { status, trial_days_remaining: daysLeft, days_until_clear: daysClear } = trialStatus;

  // Only show banner for trialing (with ≤3 days left) or past_due
  if (status === 'active') return null;
  if (status === 'trialing' && (daysLeft === undefined || daysLeft > 3)) return null;

  const isExpired = status === 'past_due' || status === 'expired';
  const bgColor = isExpired ? '#fef2f2' : '#fffbeb';
  const borderColor = isExpired ? '#fca5a5' : '#fcd34d';
  const textColor = isExpired ? '#991b1b' : '#92400e';
  const Icon = isExpired ? AlertTriangle : Clock;

  return (
    <div
      style={{
        background: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        padding: '0.5rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.8125rem',
        color: textColor,
        zIndex: 50,
        position: 'sticky',
        top: 0,
      }}
    >
      <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />

      <span style={{ flex: 1 }}>
        {isExpired
          ? <>
              {tr('trial_expired', language)}
              {daysClear !== undefined && daysClear > 0 && (
                <> &nbsp;·&nbsp; <strong>{tr('days_until_clear', language, daysClear)}</strong></>
              )}
            </>
          : tr('trial_active', language, daysLeft)
        }
      </span>

      <button
        onClick={onPayClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.3rem 0.75rem',
          background: isExpired ? '#dc2626' : '#d97706',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <CreditCard style={{ width: 14, height: 14 }} />
        {tr('pay_now', language)}
      </button>

      {!isExpired && (
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textColor, padding: 2 }}
          aria-label="Dismiss"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}
