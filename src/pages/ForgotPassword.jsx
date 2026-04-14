import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@/api/services/auth';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import LanguageSelector from '@/components/ui/language-selector';
import { Loader2, Phone, ArrowLeft, CheckCircle2, Lock, KeyRound } from 'lucide-react';
import './Login.scss';

export default function ForgotPassword() {
  const [step, setStep] = useState('phone'); // phone -> otp -> password -> success
  const [phone, setPhone] = useState('+998');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { login } = useAuth();
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.sendPasswordResetOTP(phone, 'password_reset', language);
      setStep('otp');
      setCountdown(60);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.error?.message || t('something_went_wrong') || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.verifyPasswordResetOTP(phone, otpCode, 'password_reset');
      setStep('password');
    } catch (err) {
      setError(err.response?.data?.error?.message || t('invalid_otp') || 'Invalid OTP code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('passwords_dont_match') || "Parollar mos kelmadi");
      return;
    }

    if (newPassword.length < 8) {
      setError(t('password_min_length') || "Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPasswordWithPhone(phone, otpCode, newPassword);
      // Auto-login after successful password reset
      try {
        await login(phone, newPassword);
        navigate('/', { replace: true });
        return;
      } catch (loginErr) {
        // If auto-login fails, fall back to success page
        console.error('Auto-login after password reset failed:', loginErr);
        setStep('success');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || t('something_went_wrong') || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError('');
    setIsLoading(true);
    try {
      await authService.sendPasswordResetOTP(phone, 'password_reset', language);
      setCountdown(60);
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
            src="/logo.png"
            alt="Yuksalish Logo"
            className="login-card__logo"
          />
          <h1 className="login-card__title">{t('set_password') || "Parol o'rnatish"}</h1>
        </div>

        <div className="login-card__body">
          {/* Step 1: Enter phone number */}
          {step === 'phone' && (
            <form className="login-form" onSubmit={handleSendOTP}>
              {error && <div className="login-error">{error}</div>}

              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                {t('enter_phone_for_otp') || "Telefon raqamingizni kiriting. Biz sizga tasdiqlash kodini SMS orqali yuboramiz."}
              </p>

              <div className="login-form__field">
                <label htmlFor="phone" className="login-form__label">
                  {t('phone') || 'Telefon raqam'}
                </label>
                <div className="login-form__input-wrap">
                  <Phone className="login-form__icon" />
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+998 XX XXX XX XX"
                    value={phone}
                    onChange={(e) => {
                      // Strip non-digits except leading +
                      let raw = e.target.value.replace(/[^\d+]/g, '');
                      if (!raw.startsWith('+')) raw = '+' + raw.replace(/\+/g, '');
                      const digits = raw.slice(1); // digits after +
                      // Format: +998 XX XXX XX XX
                      let formatted = '+';
                      if (digits.length > 0) formatted += digits.slice(0, 3);
                      if (digits.length > 3) formatted += ' ' + digits.slice(3, 5);
                      if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
                      if (digits.length > 8) formatted += ' ' + digits.slice(8, 10);
                      if (digits.length > 10) formatted += ' ' + digits.slice(10, 12);
                      setPhone(formatted);
                    }}
                    className="login-form__input"
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-form__submit">
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {t('sending') || "Yuborilmoqda..."}
                  </>
                ) : (
                  t('send_otp') || "Kodni yuborish"
                )}
              </button>

              <Link to="/login" className="login-back" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16 }}>
                <ArrowLeft style={{ width: 16, height: 16 }} />
                {t('back_to_login') || 'Kirish sahifasiga qaytish'}
              </Link>
            </form>
          )}

          {/* Step 2: Enter OTP */}
          {step === 'otp' && (
            <form className="login-form" onSubmit={handleVerifyOTP}>
              {error && <div className="login-error">{error}</div>}

              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                {t('otp_sent_to_phone') || `${phone} raqamiga tasdiqlash kodi yuborildi. Iltimos, kodni kiriting.`}
              </p>

              <div className="login-form__field">
                <label htmlFor="otp" className="login-form__label">
                  {t('verification_code') || 'Tasdiqlash kodi'}
                </label>
                <div className="login-form__input-wrap">
                  <KeyRound className="login-form__icon" />
                  <input
                    ref={otpInputRef}
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="login-form__input"
                    style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: 18, fontWeight: 600 }}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading || otpCode.length !== 6} className="login-form__submit">
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {t('verifying') || "Tekshirilmoqda..."}
                  </>
                ) : (
                  t('verify') || "Tasdiqlash"
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {countdown > 0 ? (
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>
                    {t('resend_in') || 'Qayta yuborish'}: {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    style={{ background: 'none', border: 'none', color: '#0EA5E9', cursor: 'pointer', fontSize: 13 }}
                  >
                    {t('resend_otp') || "Kodni qayta yuborish"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setStep('phone'); setError(''); setOtpCode(''); }}
                className="login-back"
                style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: 16, height: 16 }} />
                {t('change_phone') || "Raqamni o'zgartirish"}
              </button>
            </form>
          )}

          {/* Step 3: Set new password */}
          {step === 'password' && (
            <form className="login-form" onSubmit={handleSetPassword}>
              {error && <div className="login-error">{error}</div>}

              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                {t('enter_new_password') || "Yangi parolingizni kiriting."}
              </p>

              <div className="login-form__field">
                <label htmlFor="new-password" className="login-form__label">
                  {t('new_password') || 'Yangi parol'}
                </label>
                <div className="login-form__input-wrap">
                  <Lock className="login-form__icon" />
                  <input
                    id="new-password"
                    type="password"
                    placeholder={t('enter_new_password_placeholder') || "Yangi parolni kiriting"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="login-form__input"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="confirm-password" className="login-form__label">
                  {t('confirm_password') || 'Parolni tasdiqlang'}
                </label>
                <div className="login-form__input-wrap">
                  <Lock className="login-form__icon" />
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder={t('confirm_password_placeholder') || "Parolni qayta kiriting"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-form__input"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-form__submit">
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {t('saving') || "Saqlanmoqda..."}
                  </>
                ) : (
                  t('set_password') || "Parol o'rnatish"
                )}
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: '#10B981', margin: '0 auto 16px' }} />
              <p style={{ color: '#475569', marginBottom: 24 }}>
                {t('password_set_success') || "Parol muvaffaqiyatli o'rnatildi. Endi tizimga kirishingiz mumkin."}
              </p>
              <Link to="/login" className="login-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft style={{ width: 16, height: 16 }} />
                {t('back_to_login') || 'Kirish sahifasiga qaytish'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
