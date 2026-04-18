import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import LanguageSelector from '@/components/ui/language-selector';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import { Loader2, Mail, Lock, Phone, Building2, ArrowLeft } from 'lucide-react';
import './Login.scss';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [isPhone, setIsPhone] = useState(false);
  const [password, setPassword] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [googleCredential, setGoogleCredential] = useState(null);
  const { login, loginWithGoogle, backendAvailable, isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();

  // Translation helpers for phone-specific strings
  const T = {
    phone: { uz: 'Telefon raqam', ru: 'Номер телефона', en: 'Phone number' },
    enter_phone: { uz: 'Telefon raqamingizni kiriting', ru: 'Введите номер телефона', en: 'Enter your phone number' },
    use_email: { uz: 'Email bilan kirish', ru: 'Войти с email', en: 'Sign in with email' },
    use_phone: { uz: 'Telefon bilan kirish', ru: 'Войти с телефоном', en: 'Sign in with phone' },
  };
  const tr = (key) => T[key]?.[language] || T[key]?.en || key;

  useEffect(() => {
    if (shouldNavigate && isAuthenticated && user) {
      navigate('/');
    }
  }, [shouldNavigate, isAuthenticated, user, navigate]);

  // Reset identifier when toggling input type
  const toggleInputType = () => {
    setUsePhone(prev => !prev);
    setIdentifier('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Read directly from DOM to handle browser/Google autofill
    // (autofill may not trigger React onChange events)
    const domIdentifier = document.getElementById('identifier')?.value || identifier;
    const domPassword = document.getElementById('password')?.value || password;

    // Sync React state if autofill provided different values
    if (domIdentifier !== identifier) setIdentifier(domIdentifier);
    if (domPassword !== password) setPassword(domPassword);

    const cleanIdentifier = domIdentifier.replace(/\s/g, '');
    const result = await login(cleanIdentifier, domPassword, selectedTenantId, usePhone);

    if (result.success) {
      setShouldNavigate(true);
    } else if (result.tenantSelectionRequired) {
      setTenants(result.tenants);
      setError('');
      setIsLoading(false);
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleTenantSelect = async (tenantId) => {
    setSelectedTenantId(tenantId);
    setError('');
    setIsLoading(true);

    // Read from DOM in case autofill was used
    const domIdentifier = document.getElementById('identifier')?.value || identifier;
    const domPassword = document.getElementById('password')?.value || password;

    // Use Google auth if we have a stored credential
    const result = googleCredential
      ? await loginWithGoogle(googleCredential, tenantId)
      : await login(domIdentifier.replace(/\s/g, ''), domPassword, tenantId, usePhone);

    if (result.success) {
      setShouldNavigate(true);
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    setError('');
    setIsLoading(true);

    const result = await loginWithGoogle(credential);

    if (result.success) {
      setShouldNavigate(true);
    } else if (result.tenantSelectionRequired) {
      setGoogleCredential(credential);
      setTenants(result.tenants);
      setError('');
      setIsLoading(false);
    } else if (result.needsCompletion) {
      navigate('/register?google=1');
      setIsLoading(false);
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setTenants(null);
    setSelectedTenantId(null);
    setGoogleCredential(null);
    setError('');
  };

  // Tenant selection screen
  if (tenants && tenants.length > 0) {
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
            <h1 className="login-card__title">{t('select_company')}</h1>
            <p className="login-card__subtitle">{t('email_multiple_companies')}</p>
          </div>

          <div className="login-card__body">
            {error && (
              <div className="login-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="tenant-list">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  className="tenant-list__item"
                  onClick={() => handleTenantSelect(tenant.id)}
                  disabled={isLoading}
                >
                  <div className="tenant-list__icon-wrap">
                    <Building2 className="tenant-list__icon" />
                  </div>
                  <div>
                    <div className="tenant-list__name">{tenant.name}</div>
                    <div className="tenant-list__code">{t('code_label')}: {tenant.code}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              className="login-back"
              onClick={handleBackToLogin}
              disabled={isLoading}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {t('back_to_login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal login screen
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
          <h1 className="login-card__title">{t('welcome_back')}</h1>
        </div>

        <div className="login-card__body">
          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error">{error}</div>
            )}

            <div className="login-form__field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="identifier" className="login-form__label">
                  {usePhone ? tr('phone') : t('email')}
                </label>
                <button
                  type="button"
                  onClick={toggleInputType}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#0EA5E9',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  {usePhone ? tr('use_email') : tr('use_phone')}
                </button>
              </div>
              <div className="login-form__input-wrap">
                {usePhone
                  ? <Phone className="login-form__icon" />
                  : <Mail className="login-form__icon" />
                }
                <input
                  id="identifier"
                  name="email"
                  type={usePhone ? 'tel' : 'text'}
                  autoComplete="username"
                  placeholder={usePhone ? tr('enter_phone') : (isPhone ? '+998 XX XXX XX XX' : t('enter_email_or_phone'))}
                  value={identifier}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // If already in phone mode OR first char is digit/+
                    if (isPhone || (/^[\+\d]/.test(raw) && !raw.includes('@'))) {
                      const digits = raw.replace(/\D/g, '');
                      const local = digits.startsWith('998') ? digits.slice(3) : digits;
                      const limited = local.slice(0, 9);
                      // No local digits left → reset to email mode
                      if (limited.length === 0) {
                        setIsPhone(false);
                        setIdentifier('');
                        return;
                      }
                      setIsPhone(true);
                      let formatted = '+998';
                      if (limited.length > 0) formatted += ' ' + limited.slice(0, 2);
                      if (limited.length > 2) formatted += ' ' + limited.slice(2, 5);
                      if (limited.length > 5) formatted += ' ' + limited.slice(5, 7);
                      if (limited.length > 7) formatted += ' ' + limited.slice(7, 9);
                      setIdentifier(formatted);
                    } else {
                      setIsPhone(false);
                      setIdentifier(raw);
                    }
                  }}
                  className="login-form__input"
                  required
                />
              </div>
            </div>

            <div className="login-form__field">
              <label htmlFor="password" className="login-form__label">{t('password')}</label>
              <div className="login-form__input-wrap">
                <Lock className="login-form__icon" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('enter_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-form__input"
                  required
                />
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#0EA5E9', textDecoration: 'none' }}>
                {t('set_password') || "Parol o'rnatish"}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="login-form__submit"
            >
              {isLoading ? (
                <>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  {t('signing_in')}
                </>
              ) : (
                t('sign_in')
              )}
            </button>
          </form>

          {backendAvailable && (
            <p className="login-register">
              {t('dont_have_account')}{' '}
              <Link to="/register">{t('sign_up')}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
