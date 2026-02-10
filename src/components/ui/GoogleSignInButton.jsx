import { useEffect, useRef, useCallback } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onSuccess, text = 'continue_with' }) {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);

  const handleCredentialResponse = useCallback((response) => {
    if (response.credential) {
      onSuccess(response.credential);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || initializedRef.current) return;

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: buttonRef.current.offsetWidth || 400,
          text,
          shape: 'pill',
          logo_alignment: 'center',
        });
      }

      initializedRef.current = true;
      return true;
    };

    if (!initializeGoogle()) {
      // Google script not loaded yet — retry
      const interval = setInterval(() => {
        if (initializeGoogle()) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [handleCredentialResponse, text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} style={{ width: '100%' }} />;
}
