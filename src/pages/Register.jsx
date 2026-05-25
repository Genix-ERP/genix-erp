import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import LanguageSelector from '@/components/ui/language-selector';
import { Loader2, Mail, Lock, Building2, Phone, ArrowLeft, RefreshCw } from 'lucide-react';
import { authService } from '@/api/services/auth';
import { readStoredBrandLogo, resolveBrandLogoUrl } from '@/utils/brandLogo';
import './Login.scss';

const T = {
  uz: {
    create_account: "Ro'yxatdan o'tish",
    sign_up_to_start: "GenixERP bilan ishlashni boshlash uchun ro'yxatdan o'ting",
    complete_registration: "Ro'yxatni yakunlang",
    complete_subtitle: "Boshlash uchun kompaniya nomini kiriting",
    verify_phone: "Telefonni tasdiqlang",
    code_sent_to: "Tasdiqlash kodi yuborildi:",
    first_name: "Ism",
    last_name: "Familiya",
    phone: "Telefon raqam",
    phone_placeholder: "+998 90 123 45 67",
    email: "Elektron pochta",
    email_placeholder: "john@company.com",
    company: "Kompaniya nomi",
    company_placeholder: "Kompaniyangiz nomi",
    password: "Parol",
    password_placeholder: "Kamida 8 ta belgi",
    confirm_password: "Parolni tasdiqlang",
    confirm_placeholder: "Parolni qayta kiriting",
    continue_btn: "Davom etish",
    sending: "Yuborilmoqda...",
    create_btn: "Ro'yxatdan o'tish",
    creating: "Yaratilmoqda...",
    back_to_login: "Kirishga qaytish",
    back_to_form: "Orqaga",
    resend: "Qayta yuborish",
    resend_in: "Qayta yuborish mumkin:",
    enter_code: "Tasdiqlash kodini kiriting",
    code_expires: "Kod 10 daqiqa ichida amal qiladi",
    passwords_no_match: "Parollar mos kelmayapti",
    password_too_short: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
    phone_required: "Telefon raqam majburiy",
    enter_full_code: "Iltimos, to'liq 6 xonali kodni kiriting",
  },
  ru: {
    create_account: "Регистрация",
    sign_up_to_start: "Зарегистрируйтесь для начала работы с GenixERP",
    complete_registration: "Завершите регистрацию",
    complete_subtitle: "Введите название компании, чтобы начать",
    verify_phone: "Подтвердите телефон",
    code_sent_to: "Код подтверждения отправлен на:",
    first_name: "Имя",
    last_name: "Фамилия",
    phone: "Номер телефона",
    phone_placeholder: "+998 90 123 45 67",
    email: "Эл. почта",
    email_placeholder: "john@company.com",
    company: "Название компании",
    company_placeholder: "Название вашей компании",
    password: "Пароль",
    password_placeholder: "Минимум 8 символов",
    confirm_password: "Подтвердите пароль",
    confirm_placeholder: "Введите пароль ещё раз",
    continue_btn: "Продолжить",
    sending: "Отправка...",
    create_btn: "Зарегистрироваться",
    creating: "Создание...",
    back_to_login: "Назад к входу",
    back_to_form: "Назад",
    resend: "Отправить снова",
    resend_in: "Повторная отправка через:",
    enter_code: "Введите код подтверждения",
    code_expires: "Код действителен 10 минут",
    passwords_no_match: "Пароли не совпадают",
    password_too_short: "Пароль должен содержать не менее 8 символов",
    phone_required: "Номер телефона обязателен",
    enter_full_code: "Пожалуйста, введите полный 6-значный код",
  },
  en: {
    create_account: "Sign Up",
    sign_up_to_start: "Sign up to start using GenixERP",
    complete_registration: "Complete registration",
    complete_subtitle: "Enter your company name to get started",
    verify_phone: "Verify your phone",
    code_sent_to: "Verification code sent to:",
    first_name: "First Name",
    last_name: "Last Name",
    phone: "Phone Number",
    phone_placeholder: "+998 90 123 45 67",
    email: "Email",
    email_placeholder: "john@company.com",
    company: "Company Name",
    company_placeholder: "Your Company Inc.",
    password: "Password",
    password_placeholder: "At least 8 characters",
    confirm_password: "Confirm Password",
    confirm_placeholder: "Re-enter password",
    continue_btn: "Continue",
    sending: "Sending...",
    create_btn: "Sign Up",
    creating: "Creating...",
    back_to_login: "Back to login",
    back_to_form: "Back",
    resend: "Resend code",
    resend_in: "Resend in:",
    enter_code: "Enter verification code",
    code_expires: "Code expires in 10 minutes",
    passwords_no_match: "Passwords do not match",
    password_too_short: "Password must be at least 8 characters",
    phone_required: "Phone number is required",
    enter_full_code: "Please enter the complete 6-digit code",
  },
};

export default function Register() {
  const [brandLogoUrl] = useState(() => resolveBrandLogoUrl(readStoredBrandLogo()));
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [googleStep, setGoogleStep] = useState(null);
  const [devOtpCode, setDevOtpCode] = useState(null);
  const { registerWithOTP, loginWithGoogle, backendAvailable, isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const L = T[language] || T.en;
  const navigate = useNavigate();
  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (shouldNavigate && isAuthenticated && user) navigate('/');
  }, [shouldNavigate, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0)
      otpInputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleGoogleComplete = async (e) => {
    e.preventDefault();
    if (!googleStep || !formData.companyName.trim()) return;
    setError('');
    setIsLoading(true);
    const result = await loginWithGoogle(googleStep.credential, null, formData.companyName.trim());
    if (result.success) setShouldNavigate(true);
    else { setError(result.error); setIsLoading(false); }
  };

  const sendOTP = async () => {
    setError('');
    setIsSendingOTP(true);
    try {
      const result = await authService.sendOTP(formData.phone, 'registration', language);
      setCountdown(60);
      if (result?.dev_otp_code) {
        setOtpCode(result.dev_otp_code.split(''));
        setDevOtpCode(result.dev_otp_code);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to send OTP');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.phone.trim()) { setError(L.phone_required); return; }
    if (formData.password !== formData.confirmPassword) { setError(L.passwords_no_match); return; }
    if (formData.password.length < 8) { setError(L.password_too_short); return; }
    setIsLoading(true);
    try {
      const result = await authService.sendOTP(formData.phone, 'registration', language);
      setStep(2);
      setCountdown(60);
      if (result?.dev_otp_code) {
        setOtpCode(result.dev_otp_code.split(''));
        setDevOtpCode(result.dev_otp_code);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    const otp = otpCode.join('');
    if (otp.length !== 6) { setError(L.enter_full_code); return; }
    setIsLoading(true);
    const result = await registerWithOTP({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email || undefined,
      password: formData.password,
      companyName: formData.companyName,
      otpCode: otp,
    });
    if (result.success) {
      setShouldNavigate(true);
    } else {
      setError(result.error);
      if (result.error?.toLowerCase().includes('otp') || result.error?.toLowerCase().includes('code')) {
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
      setIsLoading(false);
    }
  };

  const title = googleStep ? L.complete_registration : step === 1 ? L.create_account : L.verify_phone;
  const subtitle = googleStep ? L.complete_subtitle
    : step === 1 ? L.sign_up_to_start
    : null;

  return (
    <div className="login-page">
      <div className="login-page__lang"><LanguageSelector /></div>

      <div className="login-card login-card--wide">
        <div className="login-card__header">
          <img src={brandLogoUrl} alt="Logo" className="login-card__logo" />
          <h1 className="login-card__title">{title}</h1>
          {subtitle && <p className="login-card__subtitle">{subtitle}</p>}
          {!subtitle && step === 2 && (
            <p className="login-card__subtitle">
              {L.code_sent_to} <strong>{formData.phone}</strong>
            </p>
          )}
        </div>

        <div className="login-card__body">

          {/* Google completion step */}
          {googleStep ? (
            <form className="login-form" onSubmit={handleGoogleComplete}>
              {error && <div className="login-error" role="alert">{error}</div>}

              <div className="login-note login-note--muted">
                <strong>{googleStep.user.first_name} {googleStep.user.last_name}</strong>
                {googleStep.user.email}
              </div>

              <div className="login-form__field">
                <label htmlFor="companyName" className="login-form__label">{L.company}</label>
                <div className="login-form__input-wrap">
                  <Building2 className="login-form__icon" />
                  <input
                    id="companyName"
                    name="companyName"
                    className="login-form__input"
                    placeholder={L.company_placeholder}
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading || !formData.companyName.trim()} className="login-form__submit">
                {isLoading ? <><Loader2 size={18} className="login-form__spinner" />{L.creating}</> : L.create_btn}
              </button>
            </form>

          ) : step === 1 ? (
            /* Registration form */
            <form className="login-form" onSubmit={handleSubmitForm}>
              {error && <div className="login-error" role="alert">{error}</div>}

              <div className="login-form__row">
                <div className="login-form__field">
                  <label htmlFor="firstName" className="login-form__label">{L.first_name}</label>
                  <div className="login-form__input-wrap">
                    <input
                      id="firstName"
                      name="firstName"
                      className="login-form__input login-form__input--plain"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="login-form__field">
                  <label htmlFor="lastName" className="login-form__label">{L.last_name}</label>
                  <div className="login-form__input-wrap">
                    <input
                      id="lastName"
                      name="lastName"
                      className="login-form__input login-form__input--plain"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="phone" className="login-form__label">{L.phone} *</label>
                <div className="login-form__input-wrap">
                  <Phone className="login-form__icon" />
                  <input
                    id="phone"
                    name="phone"
                    className="login-form__input"
                    placeholder={L.phone_placeholder}
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="email" className="login-form__label">{L.email}</label>
                <div className="login-form__input-wrap">
                  <Mail className="login-form__icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="login-form__input"
                    placeholder={L.email_placeholder}
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="companyName" className="login-form__label">{L.company}</label>
                <div className="login-form__input-wrap">
                  <Building2 className="login-form__icon" />
                  <input
                    id="companyName"
                    name="companyName"
                    className="login-form__input"
                    placeholder={L.company_placeholder}
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="login-form__row">
                <div className="login-form__field">
                  <label htmlFor="password" className="login-form__label">{L.password}</label>
                  <div className="login-form__input-wrap">
                    <Lock className="login-form__icon" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="login-form__input"
                      placeholder={L.password_placeholder}
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="login-form__field">
                  <label htmlFor="confirmPassword" className="login-form__label">{L.confirm_password}</label>
                  <div className="login-form__input-wrap">
                    <Lock className="login-form__icon" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      className="login-form__input"
                      placeholder={L.confirm_placeholder}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-form__submit">
                {isLoading ? <><Loader2 size={18} className="login-form__spinner" />{L.sending}</> : L.continue_btn}
              </button>
            </form>

          ) : (
            /* OTP verification step */
            <form className="login-form" onSubmit={handleVerifyAndRegister}>
              {error && <div className="login-error" role="alert">{error}</div>}
              {devOtpCode && (
                <div className="login-note login-note--dev">
                  Dev Mode — OTP: <code>{devOtpCode}</code>
                </div>
              )}

              <div className="login-form__field">
                <label className="login-form__label login-form__label--center">{L.enter_code}</label>
                <div className="login-otp" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => otpInputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="login-otp__input"
                      autoFocus={index === 0}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>
                <p className="login-form__hint">{L.code_expires}</p>
              </div>

              <div className="login-form__center">
                {countdown > 0 ? (
                  <p className="login-form__hint">{L.resend_in} <strong>{countdown}s</strong></p>
                ) : (
                  <button type="button" className="login-form__ghost" onClick={sendOTP} disabled={isSendingOTP}>
                    {isSendingOTP ? <Loader2 size={16} className="login-form__spinner" /> : <RefreshCw size={16} />}
                    {L.resend}
                  </button>
                )}
              </div>

              <button type="submit" disabled={isLoading || otpCode.join('').length !== 6} className="login-form__submit">
                {isLoading ? <><Loader2 size={18} className="login-form__spinner" />{L.creating}</> : L.create_btn}
              </button>

              <button
                type="button"
                className="login-back"
                onClick={() => { setStep(1); setOtpCode(['', '', '', '', '', '']); setError(''); }}
              >
                <ArrowLeft size={16} />{L.back_to_form}
              </button>
            </form>
          )}

          {(step === 1 || googleStep) && (
            <Link to="/login" className="login-back">
              <ArrowLeft size={16} />{L.back_to_login}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
