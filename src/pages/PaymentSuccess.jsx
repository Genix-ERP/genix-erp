import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const { refreshTrialStatus } = useSubscription();
  const [checking, setChecking] = useState(true);

  const users = params.get('users') || '1';
  const billing = params.get('billing') || 'monthly';

  useEffect(() => {
    // Poll subscription status — webhook may arrive shortly after redirect
    let attempts = 0;
    const poll = async () => {
      await refreshTrialStatus();
      attempts++;
      if (attempts >= 6) {
        setChecking(false);
        // Notify the original tab and close this one
        try {
          window.opener?.postMessage({ type: 'payment_success' }, '*');
        } catch (_) {}
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(poll, 2000);
      }
    };
    poll();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '3rem 2.5rem',
        textAlign: 'center', maxWidth: 440, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
        }}>
          {checking
            ? <Loader2 style={{ width: 32, height: 32, color: '#16a34a', animation: 'spin 1s linear infinite' }} />
            : <CheckCircle style={{ width: 32, height: 32, color: '#16a34a' }} />
          }
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
          To'lov muvaffaqiyatli!
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 0.25rem' }}>
          <strong>{users}</strong> foydalanuvchi · <strong style={{ textTransform: 'capitalize' }}>{billing}</strong> tarif faollashtirildi.
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>
          {checking ? 'Faollashtirish tekshirilmoqda...' : 'Bu oyna yopilmoqda...'}
        </p>
      </div>
    </div>
  );
}
