import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function PaymentError() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#fff1f2,#ffe4e6)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '3rem 2.5rem',
        textAlign: 'center', maxWidth: 440, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
        }}>
          <XCircle style={{ width: 32, height: 32, color: '#dc2626' }} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
          To'lov amalga oshmadi
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 2rem' }}>
          To'lov bekor qilindi yoki xatolik yuz berdi. Qayta urinib ko'ring.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.625rem 1.5rem', background: '#0f172a', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Orqaga qaytish
        </button>
      </div>
    </div>
  );
}
