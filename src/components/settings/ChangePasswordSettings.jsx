import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Check, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from '@/components/contexts/AuthContext';

export default function ChangePasswordSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { changePassword } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const successTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current); };
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    setError('');
    setSuccess(false);
  };

  const validatePassword = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError(t('all_fields_required') || "Barcha maydonlar to'ldirilishi kerak");
      return false;
    }
    if (formData.newPassword.length < 8) {
      setError(t('password_too_short') || "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwords_dont_match') || "Yangi parollar mos kelmadi");
      return false;
    }
    if (formData.currentPassword === formData.newPassword) {
      setError(t('password_must_differ') || "Yangi parol joriy paroldan farq qilishi kerak");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await changePassword(formData.currentPassword, formData.newPassword);

      if (result?.success) {
        setSuccess(true);
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(result?.error || t('password_change_failed') || "Parolni o'zgartirishda xatolik yuz berdi");
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || t('password_change_failed') || "Parolni o'zgartirishda xatolik";
      setError(message);
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t('change_password')}
        </CardTitle>
        <CardDescription>
          {t('change_password_description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
              <Check className="w-4 h-4" />
              {t('password_changed_success') || "Parol muvaffaqiyatli o'zgartirildi"}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('current_password')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleChange}
              placeholder={t('current_password_placeholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('new_password')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder={t('new_password_placeholder')}
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">{t('password_min_length')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirm_new_password')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={t('confirm_password_placeholder')}
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' }); setError(''); }}
              disabled={isLoading}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('updating_password')}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {t('change_password')}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
