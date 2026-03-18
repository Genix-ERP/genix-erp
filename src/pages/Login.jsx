import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import LanguageSelector from '@/components/ui/language-selector';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import { Loader2, User, Lock, Building2, ArrowLeft } from 'lucide-react';
import './Login.scss';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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

  useEffect(() => {
    if (shouldNavigate && isAuthenticated && user) {
      navigate('/');
    }
  }, [shouldNavigate, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(identifier, password, selectedTenantId);

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

    // Use Google auth if we have a stored credential
    const result = googleCredential
      ? await loginWithGoogle(googleCredential, tenantId)
      : await login(identifier, password, tenantId);

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
      // New Google user — redirect to register page (they'll need to provide company name)
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
              src="/logo.png"
              alt="Yuksalish Logo"
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
            src="/logo.png"
            alt="Yuksalish Logo"
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
              <label htmlFor="identifier" className="login-form__label">{t('email_or_phone')}</label>
              <div className="login-form__input-wrap">
                <User className="login-form__icon" />
                <input
                  id="identifier"
                  type="text"
                  placeholder={t('enter_email_or_phone')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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
                  type="password"
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
                {t('forgot_password') || "Parolni unutdingizmi?"}
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

          <div className="login-divider">
            <span>{t('or_continue_with') || 'Or continue with'}</span>
          </div>

          <GoogleSignInButton onSuccess={handleGoogleLogin} text="signin_with" />

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
