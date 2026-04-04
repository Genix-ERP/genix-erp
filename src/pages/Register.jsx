import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LanguageSelector from '@/components/ui/language-selector';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import { Loader2, Mail, Lock, User, Building2, Phone, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import { authService } from '@/api/services/auth';

const T = {
  uz: {
    create_account: "Hisob yaratish",
    sign_up_to_start: "GenixERP bilan ishlashni boshlash uchun ro'yxatdan o'ting",
    verify_phone: "Telefonni tasdiqlang",
    code_sent_to: "Tasdiqlash kodi yuborildi:",
    first_name: "Ism",
    last_name: "Familiya",
    phone: "Telefon raqam",
    phone_placeholder: "+998 90 123 45 67",
    email: "Elektron pochta (ixtiyoriy)",
    email_placeholder: "john@company.com",
    company: "Kompaniya nomi",
    company_placeholder: "Kompaniyangiz nomi",
    password: "Parol",
    password_placeholder: "Kamida 8 ta belgi",
    confirm_password: "Parolni tasdiqlang",
    confirm_placeholder: "Parolni qayta kiriting",
    continue_btn: "Davom etish",
    sending: "Yuborilmoqda...",
    create_btn: "Hisob yaratish",
    creating: "Yaratilmoqda...",
    or: "Yoki davom eting",
    back_to_login: "← Kirishga qaytish",
    back_to_form: "Orqaga",
    resend: "Qayta yuborish",
    resend_in: "Qayta yuborish mumkin:",
    enter_code: "Tasdiqlash kodini kiriting",
    code_expires: "Kod 10 daqiqa ichida amal qiladi",
    passwords_no_match: "Parollar mos kelmayapti",
    password_too_short: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
    phone_required: "Telefon raqam majburiy",
  },
  ru: {
    create_account: "Создать аккаунт",
    sign_up_to_start: "Зарегистрируйтесь для начала работы с GenixERP",
    verify_phone: "Подтвердите телефон",
    code_sent_to: "Код подтверждения отправлен на:",
    first_name: "Имя",
    last_name: "Фамилия",
    phone: "Номер телефона",
    phone_placeholder: "+998 90 123 45 67",
    email: "Эл. почта (необязательно)",
    email_placeholder: "john@company.com",
    company: "Название компании",
    company_placeholder: "Название вашей компании",
    password: "Пароль",
    password_placeholder: "Минимум 8 символов",
    confirm_password: "Подтвердите пароль",
    confirm_placeholder: "Введите пароль ещё раз",
    continue_btn: "Продолжить",
    sending: "Отправка...",
    create_btn: "Создать аккаунт",
    creating: "Создание...",
    or: "Или продолжить с",
    back_to_login: "← Назад к входу",
    back_to_form: "Назад",
    resend: "Отправить снова",
    resend_in: "Повторная отправка через:",
    enter_code: "Введите код подтверждения",
    code_expires: "Код действителен 10 минут",
    passwords_no_match: "Пароли не совпадают",
    password_too_short: "Пароль должен содержать не менее 8 символов",
    phone_required: "Номер телефона обязателен",
  },
  en: {
    create_account: "Create Account",
    sign_up_to_start: "Sign up to start using GenixERP",
    verify_phone: "Verify your phone",
    code_sent_to: "Verification code sent to:",
    first_name: "First Name",
    last_name: "Last Name",
    phone: "Phone Number",
    phone_placeholder: "+998 90 123 45 67",
    email: "Email (optional)",
    email_placeholder: "john@company.com",
    company: "Company Name",
    company_placeholder: "Your Company Inc.",
    password: "Password",
    password_placeholder: "At least 8 characters",
    confirm_password: "Confirm Password",
    confirm_placeholder: "Re-enter password",
    continue_btn: "Continue",
    sending: "Sending...",
    create_btn: "Create Account",
    creating: "Creating...",
    or: "Or continue with",
    back_to_login: "← Back to login",
    back_to_form: "Back",
    resend: "Resend code",
    resend_in: "Resend in:",
    enter_code: "Enter verification code",
    code_expires: "Code expires in 10 minutes",
    passwords_no_match: "Passwords do not match",
    password_too_short: "Password must be at least 8 characters",
    phone_required: "Phone number is required",
  },
};

export default function Register() {
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
  const [success, setSuccess] = useState('');
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

  const handleGoogleRegister = async (credential) => {
    setError('');
    setIsLoading(true);
    const result = await loginWithGoogle(credential);
    if (result.success) {
      setShouldNavigate(true);
    } else if (result.needsCompletion) {
      setGoogleStep({ credential, user: result.googleUser });
      setFormData(prev => ({
        ...prev,
        firstName: result.googleUser.first_name || '',
        lastName: result.googleUser.last_name || '',
        email: result.googleUser.email || '',
      }));
      setIsLoading(false);
    } else {
      setError(result.error);
      setIsLoading(false);
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
      setSuccess('');
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
    if (otp.length !== 6) { setError('Please enter the complete 6-digit code'); return; }
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

  const inputCls = "pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 relative">
      <style>{`:root { --genix-navy:#0B1426; --genix-blue:#0EA5E9; --genix-purple:#8B5CF6; }`}</style>

      <div className="absolute top-4 right-4"><LanguageSelector /></div>

      <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d244cb8a392237a5acfbd9/a049d6898_Logo.png"
            alt="Genix Logo" className="h-20 w-auto object-contain mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold text-[var(--genix-navy)]">
            {googleStep ? 'Complete Registration' : step === 1 ? L.create_account : L.verify_phone}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {googleStep ? 'Enter your company name to get started'
              : step === 1 ? L.sign_up_to_start
              : <>{L.code_sent_to} <span className="font-medium text-slate-700">{formData.phone}</span></>}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Google complete step */}
          {googleStep ? (
            <form onSubmit={handleGoogleComplete} className="space-y-4">
              {error && <Alert variant="destructive" className="bg-red-50 border-red-200"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p className="font-medium text-slate-800">{googleStep.user.first_name} {googleStep.user.last_name}</p>
                <p>{googleStep.user.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">{L.company}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input name="companyName" placeholder={L.company_placeholder} value={formData.companyName} onChange={handleChange} className={inputCls} required autoFocus />
                </div>
              </div>
              <Button type="submit" disabled={isLoading || !formData.companyName.trim()} className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L.creating}</> : L.create_btn}
              </Button>
            </form>

          ) : step === 1 ? (
            /* Registration form */
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {error && <Alert variant="destructive" className="bg-red-50 border-red-200"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-700">{L.first_name}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} className={inputCls} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">{L.last_name}</Label>
                  <Input name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} className="h-10 bg-slate-50/50 border-slate-200" required />
                </div>
              </div>

              {/* Phone — required */}
              <div className="space-y-2">
                <Label className="text-slate-700">{L.phone} *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="phone" placeholder={L.phone_placeholder} value={formData.phone} onChange={handleChange} className={inputCls} required />
                </div>
              </div>

              {/* Email — optional */}
              <div className="space-y-2">
                <Label className="text-slate-700">{L.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="email" placeholder={L.email_placeholder} value={formData.email} onChange={handleChange} className={inputCls} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">{L.company}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="companyName" placeholder={L.company_placeholder} value={formData.companyName} onChange={handleChange} className={inputCls} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">{L.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="password" type="password" placeholder={L.password_placeholder} value={formData.password} onChange={handleChange} className={inputCls} required minLength={8} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">{L.confirm_password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="confirmPassword" type="password" placeholder={L.confirm_placeholder} value={formData.confirmPassword} onChange={handleChange} className={inputCls} required />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L.sending}</> : L.continue_btn}
              </Button>

              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'1rem 0', color:'#94a3b8', fontSize:'0.75rem' }}>
                <span style={{ flex:1, height:1, background:'#e2e8f0' }} />
                <span>{L.or}</span>
                <span style={{ flex:1, height:1, background:'#e2e8f0' }} />
              </div>
              <GoogleSignInButton onSuccess={handleGoogleRegister} />
            </form>

          ) : (
            /* OTP verification step */
            <form onSubmit={handleVerifyAndRegister} className="space-y-6">
              {error && <Alert variant="destructive" className="bg-red-50 border-red-200"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
              {devOtpCode && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="text-amber-700 text-sm">
                    <span className="font-semibold">Dev Mode:</span> OTP — <span className="font-mono font-bold">{devOtpCode}</span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <Label className="text-slate-700 text-center block">{L.enter_code}</Label>
                <div className="flex justify-center gap-2">
                  {otpCode.map((digit, index) => (
                    <Input
                      key={index}
                      ref={el => otpInputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-14 text-center text-2xl font-bold bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-400 text-center">{L.code_expires}</p>
              </div>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-slate-500">{L.resend_in} <span className="font-medium text-slate-700">{countdown}s</span></p>
                ) : (
                  <Button type="button" variant="ghost" onClick={sendOTP} disabled={isSendingOTP} className="text-[var(--genix-blue)]">
                    {isSendingOTP ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {L.resend}
                  </Button>
                )}
              </div>

              <Button type="submit" disabled={isLoading || otpCode.join('').length !== 6} className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L.creating}</> : L.create_btn}
              </Button>

              <Button type="button" variant="ghost" onClick={() => { setStep(1); setOtpCode(['','','','','','']); setError(''); }} className="w-full text-slate-600">
                <ArrowLeft className="w-4 h-4 mr-2" />{L.back_to_form}
              </Button>
            </form>
          )}

          {(step === 1 || googleStep) && (
            <div className="mt-4 text-center">
              <Link to="/login" className="inline-flex items-center text-sm text-slate-600 hover:text-[var(--genix-blue)]">
                <ArrowLeft className="w-4 h-4 mr-1" />{L.back_to_login}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
