import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authService } from '@/api/services/auth';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import LanguageSelector from '@/components/ui/language-selector';
import { Loader2, Lock, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import './Login.scss';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current); };
  }, []);

  // No token in URL
  if (!token) {
    return (
      <div className="login-page">
        <div className="login-page__lang">
          <LanguageSelector />
        </div>
        <div className="login-card">
          <div className="login-card__body" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <XCircle style={{ width: 48, height: 48, color: '#ef4444', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
              {t('invalid_reset_link') || "Noto'g'ri yoki muddati o'tgan havola"}
            </h2>
            <p style={{ color: '#64748b', marginBottom: 24 }}>
              {t('reset_link_missing') || "Parolni tiklash havolasi noto'g'ri. Iltimos, qaytadan urinib ko'ring."}
            </p>
            <Link to="/forgot-password" className="login-back" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {t('request_new_link') || "Yangi havola so'rash"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match') || "Parollar mos kelmadi");
      return;
    }

    if (password.length < 8) {
      setError(t('password_min_length') || "Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
      // Redirect to login after 2 seconds
      redirectTimeoutRef.current = setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const msg = err.response?.data?.error?.message;
      if (msg && msg.includes('expired')) {
        setError(t('invalid_reset_link') || "Noto'g'ri yoki muddati o'tgan havola");
      } else {
        setError(msg || t('something_went_wrong') || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__lang">
        <LanguageSelector />
      </div>

      <div className="login-card">
        <div className="login-card__header">
          <img
            src="/yuksalish-logo.png"
            alt="Yuksalish Logo"
            className="login-card__logo"
          />
          <h1 className="login-card__title">{t('reset_password') || "Parolni tiklash"}</h1>
        </div>

        <div className="login-card__body">
          {isSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: '#10B981', margin: '0 auto 16px' }} />
              <p style={{ color: '#475569', fontWeight: 500, marginBottom: 8 }}>
                {t('password_reset_success') || "Parol muvaffaqiyatli tiklandi!"}
              </p>
              <p style={{ color: '#94a3b8', fontSize: 14 }}>
                {t('redirecting_to_login') || "Kirish sahifasiga yo'naltirilmoqda..."}
              </p>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <div className="login-error">{error}</div>
              )}

              <div className="login-form__field">
                <label htmlFor="password" className="login-form__label">
                  {t('new_password') || "Yangi parol"}
                </label>
                <div className="login-form__input-wrap">
                  <Lock className="login-form__icon" />
                  <input
                    id="password"
                    type="password"
                    placeholder={t('password_min_hint') || "Kamida 8 ta belgi"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-form__input"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="confirmPassword" className="login-form__label">
                  {t('confirm_new_password') || "Yangi parolni tasdiqlang"}
                </label>
                <div className="login-form__input-wrap">
                  <Lock className="login-form__icon" />
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('confirm_password_placeholder') || "Parolni qayta kiriting"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-form__input"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="login-form__submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {t('resetting') || "Tiklanmoqda..."}
                  </>
                ) : (
                  t('reset_password') || "Parolni tiklash"
                )}
              </button>

              <Link to="/login" className="login-back" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16 }}>
                <ArrowLeft style={{ width: 16, height: 16 }} />
                {t('back_to_login') || 'Back to Login'}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
