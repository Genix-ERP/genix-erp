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
import { Loader2, Mail, Lock, User, Building2, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import { authService } from '@/api/services/auth';

export default function Register() {
  const [step, setStep] = useState(1); // 1: Form, 2: OTP verification
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
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
  const [googleStep, setGoogleStep] = useState(null); // null or { credential, user }
  const { registerWithOTP, loginWithGoogle, backendAvailable, isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const otpInputRefs = useRef([]);

  // Navigate only after auth state is confirmed
  useEffect(() => {
    if (shouldNavigate && isAuthenticated && user) {
      navigate('/');
    }
  }, [shouldNavigate, isAuthenticated, user, navigate]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Handle backspace - move to previous input
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtpCode(newOtp);
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
      // Show company name step
      setGoogleStep({ credential, user: result.googleUser });
      setFormData(prev => ({
        ...prev,
        firstName: result.googleUser.first_name || '',
        lastName: result.googleUser.last_name || '',
        email: result.googleUser.email || '',
      }));
      setIsLoading(false);
    } else if (result.tenantSelectionRequired) {
      setError(t('email_multiple_companies') || 'This email is associated with multiple accounts. Please sign in instead.');
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

    if (result.success) {
      setShouldNavigate(true);
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const sendOTP = async () => {
    setError('');
    setIsSendingOTP(true);

    try {
      await authService.sendOTP(formData.email, 'registration', language);
      setSuccess(t('otp_sent_success'));
      setCountdown(60); // 60 seconds countdown for resend
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to send OTP';
      setError(message);
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwords_dont_match'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('password_min_length'));
      return;
    }

    setIsLoading(true);

    try {
      // Send OTP to email with selected language
      await authService.sendOTP(formData.email, 'registration', language);
      setStep(2);
      setSuccess(t('otp_sent_success'));
      setCountdown(60);
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to send OTP';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const otp = otpCode.join('');
    if (otp.length !== 6) {
      setError(t('enter_complete_otp'));
      return;
    }

    setIsLoading(true);

    const result = await registerWithOTP({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      companyName: formData.companyName,
      otpCode: otp,
    });

    if (result.success) {
      // Set flag to navigate - useEffect will handle navigation after state updates
      setShouldNavigate(true);
    } else {
      setError(result.error);
      // If OTP is invalid, allow retry
      if (result.error?.toLowerCase().includes('otp')) {
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 relative">
      <style>
        {`
          :root {
            --genix-navy: #0B1426;
            --genix-blue: #0EA5E9;
            --genix-light-blue: #E0F2FE;
            --genix-purple: #8B5CF6;
            --genix-green: #10B981;
          }
        `}
      </style>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <img
            src="/logo.png"
            alt="Yuksalish Logo"
            className="h-20 w-auto object-contain mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold text-[var(--genix-navy)]">
            {googleStep ? t('complete_registration') || 'Complete Registration' : step === 1 ? t('create_account') : t('verify_email')}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {googleStep ? (
              <>{t('enter_company_name') || 'Enter your company name to get started'}</>
            ) : step === 1 ? (
              backendAvailable
                ? t('sign_up_to_start')
                : t('demo_mode_register')
            ) : (
              <>{t('enter_otp_code')} <span className="font-medium text-slate-700">{formData.email}</span></>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {googleStep ? (
            <form onSubmit={handleGoogleComplete} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p className="font-medium text-slate-800">{googleStep.user.first_name} {googleStep.user.last_name}</p>
                <p>{googleStep.user.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-700">{t('company_name')}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="companyName"
                    name="companyName"
                    placeholder={t('enter_company_name_placeholder') || 'Your Company Inc.'}
                    value={formData.companyName}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !formData.companyName.trim()}
                className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:from-[var(--genix-blue)]/90 hover:to-[var(--genix-purple)]/90 text-white font-medium transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('creating_account')}
                  </>
                ) : (
                  t('create_account')
                )}
              </Button>

            </form>
          ) : step === 1 ? (
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-700">{t('first_name')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-700">{t('last_name')}</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-700">{t('company_name_field')}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    placeholder="Your Company Inc."
                    value={formData.companyName}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t('at_least_8_chars')}
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-700">{t('confirm_password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder={t('confirm_your_password')}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:from-[var(--genix-blue)]/90 hover:to-[var(--genix-purple)]/90 text-white font-medium transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('sending_verification')}
                  </>
                ) : (
                  t('continue_btn')
                )}
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span>{t('or_continue_with') || 'Or continue with'}</span>
                <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <GoogleSignInButton onSuccess={handleGoogleRegister} />
            </form>
          ) : (
            <form onSubmit={handleVerifyAndRegister} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {/* OTP Input */}
              <div className="space-y-4">
                <Label className="text-slate-700 text-center block">{t('enter_verification_code')}</Label>
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
                <p className="text-xs text-slate-400 text-center">{t('otp_expires_info')}</p>
              </div>

              {/* Resend OTP */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-slate-500">
                    {t('resend_code_in')} <span className="font-medium text-slate-700">{countdown}s</span>
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={sendOTP}
                    disabled={isSendingOTP}
                    className="text-[var(--genix-blue)] hover:text-[var(--genix-purple)]"
                  >
                    {isSendingOTP ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('resend_code')}
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.join('').length !== 6}
                className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:from-[var(--genix-blue)]/90 hover:to-[var(--genix-purple)]/90 text-white font-medium transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('creating_account')}
                  </>
                ) : (
                  t('create_account')
                )}
              </Button>

              {/* Back button */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(1);
                  setOtpCode(['', '', '', '', '', '']);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-slate-600 hover:text-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('back_to_form')}
              </Button>
            </form>
          )}

          {(step === 1 || googleStep) && (
            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-slate-600 hover:text-[var(--genix-blue)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('back_to_sign_in')}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
