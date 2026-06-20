import React, { useEffect, useRef, useState } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField } from './SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Globe, Upload, Trash2, AlertCircle, Loader2, Check } from 'lucide-react';
import apiClient from '@/api/client';
import { resolveBrandLogoUrl, resolveBrandFaviconUrl } from '@/utils/brandLogo';

const MAX_LOGO_BYTES = 1024 * 1024 * 2; // 2 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

// Uploads a brand image to the backend and returns its stored URL.
async function uploadBrandImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const url = res?.data?.data?.url || res?.data?.url;
  if (!url) throw new Error('No URL in upload response');
  return url;
}

// Reusable upload control shared by the logo and favicon fields. `resolveUrl`
// turns the stored value into a renderable preview; `onCommit(url|null)` persists.
function ImageUploadField({
  currentUrl,
  resolveUrl,
  onCommit,
  uploadLabel,
  replaceLabel,
  removeLabel,
  previewClassName,
  t,
}) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const previewSrc = resolveUrl(currentUrl);
  const isCustom = !!currentUrl;

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
      const url = await uploadBrandImage(file);
      const ok = await onCommit(url);
      if (!ok) throw new Error('Failed to persist branding asset');
    } catch (err) {
      console.error('Branding upload failed:', err);
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
      const ok = await onCommit(null);
      if (!ok) throw new Error('Failed to remove branding asset');
    } catch (err) {
      console.error('Branding remove failed:', err);
      setError(t('logo_upload_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-3 overflow-hidden ${previewClassName}`}>
          <img
            src={previewSrc}
            alt="Brand preview"
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
            {isUploading ? t('uploading') : isCustom ? replaceLabel : uploadLabel}
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
              {removeLabel}
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
    </>
  );
}

// Browser-title text field — saves on demand (commit-on-Save, not on each
// keystroke). Empty input clears the override and falls back to the default.
function BrowserTitleField({ currentTitle, onCommit, t }) {
  const [value, setValue] = useState(currentTitle || '');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Re-sync when the committed value changes (load / external update). This only
  // fires when `currentTitle` actually changes, so it never clobbers typing.
  useEffect(() => {
    setValue(currentTitle || '');
  }, [currentTitle]);

  const isDirty = (value.trim() || '') !== (currentTitle || '');

  const handleSave = async () => {
    setIsSaving(true);
    setJustSaved(false);
    try {
      const ok = await onCommit(value.trim() || null);
      if (ok) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-md">
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('browser_title_placeholder')}
        maxLength={60}
        className="flex-1"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleSave}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : justSaved ? (
          <Check className="w-4 h-4" />
        ) : null}
        {isSaving ? t('saving') : justSaved ? t('saved') : t('save')}
      </Button>
    </div>
  );
}

export default function BrandingSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, commitLogoUrl, commitFaviconUrl, commitBrowserTitle } = useAdminSettings();

  const company = settings?.general?.company || {};

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
          <ImageUploadField
            currentUrl={company.logo_url || null}
            resolveUrl={resolveBrandLogoUrl}
            onCommit={commitLogoUrl}
            uploadLabel={t('upload_logo')}
            replaceLabel={t('replace_logo')}
            removeLabel={t('remove_logo')}
            previewClassName="w-32 h-32"
            t={t}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title={t('browser_appearance')}
        description={t('browser_appearance_desc')}
        icon={Globe}
      >
        <SettingsField
          label={t('browser_icon')}
          description={t('browser_icon_help')}
        >
          <ImageUploadField
            currentUrl={company.favicon_url || null}
            resolveUrl={resolveBrandFaviconUrl}
            onCommit={commitFaviconUrl}
            uploadLabel={t('upload_icon')}
            replaceLabel={t('replace_icon')}
            removeLabel={t('remove_icon')}
            previewClassName="w-16 h-16"
            t={t}
          />
        </SettingsField>

        <div className="mt-6">
          <SettingsField
            label={t('browser_title')}
            description={t('browser_title_help')}
          >
            <BrowserTitleField
              currentTitle={company.browser_title || ''}
              onCommit={commitBrowserTitle}
              t={t}
            />
          </SettingsField>
        </div>
      </SettingsSection>
    </div>
  );
}
