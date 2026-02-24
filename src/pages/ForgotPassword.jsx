import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '@/api/services/auth';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import LanguageSelector from '@/components/ui/language-selector';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import './Login.scss';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || t('something_went_wrong') || 'Something went wrong');
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
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d244cb8a392237a5acfbd9/a049d6898_Logo.png"
            alt="Genix Logo"
            className="login-card__logo"
          />
          <h1 className="login-card__title">{t('forgot_password') || "Parolni unutdingizmi?"}</h1>
        </div>

        <div className="login-card__body">
          {isSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: '#10B981', margin: '0 auto 16px' }} />
              <p style={{ color: '#475569', marginBottom: 24 }}>
                {t('reset_link_sent') || "Agar ushbu email bilan hisob mavjud bo'lsa, parolni tiklash havolasi yuborildi."}
              </p>
              <Link to="/login" className="login-back">
                <ArrowLeft style={{ width: 16, height: 16 }} />
                {t('back_to_login') || 'Back to Login'}
              </Link>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <div className="login-error">{error}</div>
              )}

              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                {t('enter_your_email') || "Email manzilingizni kiriting va biz sizga parolni tiklash havolasini yuboramiz."}
              </p>

              <div className="login-form__field">
                <label htmlFor="email" className="login-form__label">{t('email')}</label>
                <div className="login-form__input-wrap">
                  <Mail className="login-form__icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder={t('enter_email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    {t('sending') || "Yuborilmoqda..."}
                  </>
                ) : (
                  t('send_reset_link') || "Tiklash havolasini yuborish"
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
