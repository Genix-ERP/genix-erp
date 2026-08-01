import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// The fallback must never depend on React context: if a provider itself
// crashed, a context hook here would take the boundary down with it. So the
// language comes straight from localStorage (same key LanguageContext uses)
// and the three strings are inlined per language.
const FALLBACK_STRINGS = {
  uz: {
    title: 'Xatolik yuz berdi',
    message: "Sahifani yuklashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
    retry: 'Qayta urinish',
  },
  ru: {
    title: 'Произошла ошибка',
    message: 'При загрузке страницы произошла ошибка. Пожалуйста, попробуйте ещё раз.',
    retry: 'Повторить',
  },
  en: {
    title: 'Something went wrong',
    message: 'An error occurred while loading this page. Please try again.',
    retry: 'Try Again',
  },
};

function getFallbackStrings() {
  let lang = 'uz';
  try {
    lang = localStorage.getItem('erp_language') || 'uz';
  } catch {
    // storage unavailable — keep the default
  }
  return FALLBACK_STRINGS[lang] || FALLBACK_STRINGS.uz;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // Auto-reload on stale chunk errors (happens after new deployments)
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk') ||
      error?.message?.includes('Importing a module script failed');

    if (isChunkError) {
      const reloadKey = 'chunk_reload_' + window.location.pathname;
      const lastReload = sessionStorage.getItem(reloadKey);
      // Only auto-reload once per page to avoid infinite reload loops
      if (!lastReload) {
        sessionStorage.setItem(reloadKey, Date.now().toString());
        window.location.reload();
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Reset error state when location changes (e.g., navigation to different page)
    if (this.state.hasError && this.props.location !== prevProps.location) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const s = getFallbackStrings();
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {s.title}
            </h2>
            <p className="text-slate-600 mb-4">
              {s.message}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-slate-100 p-4 rounded-lg mb-4 overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {s.retry}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
