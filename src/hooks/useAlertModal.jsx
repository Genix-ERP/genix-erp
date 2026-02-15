import { useState, useCallback } from 'react';

/**
 * Hook for showing alert modals instead of browser alert().
 *
 * Usage:
 *   const { alertModal, showAlert, showError, showSuccess } = useAlertModal();
 *
 *   showAlert('Some message');
 *   showError('Error occurred');
 *   showSuccess('Operation completed');
 *
 *   // In JSX:
 *   return <>{alertModal}</>
 */
export function useAlertModal() {
  const [modal, setModal] = useState({ open: false, title: '', message: '', variant: 'default' });

  const showAlert = useCallback((message, title) => {
    setModal({ open: true, title: title || '', message, variant: 'default' });
  }, []);

  const showError = useCallback((message, title) => {
    setModal({ open: true, title: title || 'Xatolik', message, variant: 'error' });
  }, []);

  const showSuccess = useCallback((message, title) => {
    setModal({ open: true, title: title || 'Muvaffaqiyatli', message, variant: 'success' });
  }, []);

  const close = useCallback(() => {
    setModal(prev => ({ ...prev, open: false }));
  }, []);

  return { modal, showAlert, showError, showSuccess, close };
}
