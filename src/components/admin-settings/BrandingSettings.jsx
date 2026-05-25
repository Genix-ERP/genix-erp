import React, { useRef, useState } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField } from './SettingsSection';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Upload, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '@/api/client';
import { resolveBrandLogoUrl } from '@/utils/brandLogo';

const MAX_LOGO_BYTES = 1024 * 1024 * 2; // 2 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

export default function BrandingSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, commitLogoUrl } = useAdminSettings();
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const currentLogo = settings?.general?.company?.logo_url || null;
  const previewSrc = resolveBrandLogoUrl(currentLogo);
  const isCustom = !!previewSrc;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('logo_invalid_type'));
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(t('logo_too_large'));
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res?.data?.data?.url || res?.data?.url;
      if (!url) throw new Error('No URL in upload response');
      const ok = await commitLogoUrl(url);
      if (!ok) throw new Error('Failed to persist logo');
    } catch (err) {
      console.error('Logo upload failed:', err);
      setError(t('logo_upload_failed'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    setError('');
    setIsUploading(true);
    try {
      const ok = await commitLogoUrl(null);
      if (!ok) throw new Error('Failed to remove logo');
    } catch (err) {
      console.error('Logo remove failed:', err);
      setError(t('logo_upload_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('company_logo')}
        description={t('company_logo_desc')}
        icon={ImageIcon}
      >
        <SettingsField
          label={t('current_logo')}
          description={t('logo_help_text')}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center justify-center w-32 h-32 rounded-lg border border-slate-200 bg-slate-50 p-3 overflow-hidden">
              <img
                src={previewSrc}
                alt="Logo preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading
                  ? t('uploading')
                  : isCustom
                    ? t('replace_logo')
                    : t('upload_logo')}
              </Button>
              {isCustom && !isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('remove_logo')}
                </Button>
              )}
              <p className="text-xs text-slate-500 max-w-xs">
                {t('logo_format_hint')}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
