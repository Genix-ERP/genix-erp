import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Phone, Check, AlertCircle, X } from "lucide-react";
import { toast } from 'sonner';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { formatPhoneInput, parsePhoneInput } from '@/utils/formatCurrency';
import authService from '@/api/services/auth';

export default function ProfileSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser, updateUser, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    title: '',
    phone_number: '+998',
    bio: '',
    profile_picture_url: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Phone OTP state
  const [showPhoneOTP, setShowPhoneOTP] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpRefs = useRef([]);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        title: currentUser.title || '',
        phone_number: currentUser.phone_number || currentUser.phone || '+998',
        bio: currentUser.bio || '',
        profile_picture_url: currentUser.profile_picture_url || currentUser.avatar_url || ''
      });
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const localUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, profile_picture_url: localUrl }));
    setIsUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Split full_name into first/last for the API
      const parts = formData.full_name.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      const payload = {
        first_name: firstName,
        last_name: lastName,
      };

      // Update email if changed
      if (formData.email && formData.email !== (currentUser?.email || '')) {
        try {
          await authService.updateEmail(formData.email);
        } catch (err) {
          const msg = err.response?.data?.error?.message || t('email_update_failed') || 'Failed to update email';
          toast.error(msg);
          setIsSaving(false);
          return;
        }
      }

      // Update other profile fields
      const result = await updateUser(payload);
      if (result?.success) {
        toast.success(t('profile_updated') || 'Profil yangilandi');
        if (refreshUser) await refreshUser();
      } else {
        toast.error(result?.error || t('profile_update_failed') || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(t('profile_update_failed') || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Phone OTP logic ──
  const openPhoneOTPModal = useCallback(() => {
    setNewPhone(formData.phone_number || '+998');
    setOtpCode(['', '', '', '', '', '']);
    setOtpError('');
    setOtpSent(false);
    setOtpCountdown(0);
    setShowPhoneOTP(true);
  }, [formData.phone_number]);

  const startCountdown = () => {
    setOtpCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!newPhone || newPhone.length < 9) {
      setOtpError(t('enter_valid_phone') || "To'g'ri telefon raqam kiriting");
      return;
    }
    setOtpSending(true);
    setOtpError('');
    try {
      const result = await authService.sendPhoneOTP(newPhone);
      setOtpSent(true);
      startCountdown();
      // In dev mode, auto-fill OTP
      if (result?.dev_otp_code) {
        const code = result.dev_otp_code.split('');
        setOtpCode(code);
      }
      toast.success(t('otp_sent') || 'Tasdiqlash kodi yuborildi');
    } catch (err) {
      setOtpError(err.response?.data?.error?.message || t('otp_send_failed') || 'SMS yuborishda xatolik');
    } finally {
      setOtpSending(false);
    }
  };

  const handleOTPChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setOtpCode(pastedData.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setOtpError(t('enter_full_otp') || 'Tasdiqlash kodini to\'liq kiriting');
      return;
    }
    setOtpVerifying(true);
    setOtpError('');
    try {
      await authService.verifyPhoneOTP(newPhone, code);
      toast.success(t('phone_updated') || 'Telefon raqam yangilandi');
      setShowPhoneOTP(false);
      setFormData(prev => ({ ...prev, phone_number: newPhone }));
      if (refreshUser) await refreshUser();
    } catch (err) {
      setOtpError(err.response?.data?.error?.message || t('otp_verify_failed') || 'Kod noto\'g\'ri');
    } finally {
      setOtpVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile')}</CardTitle>
          <CardDescription>{t('profile_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={formData.profile_picture_url} alt={formData.full_name} />
                <AvatarFallback>{formData.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="profile_picture">{t('profile_picture')}</Label>
                <Input id="profile_picture" type="file" onChange={handleFileChange} disabled={isUploading} />
                {isUploading && <p className="text-sm text-slate-500">{t('uploading')}...</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('full_name')}</Label>
                <Input id="full_name" value={formData.full_name} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('title')}</Label>
                <Input id="title" value={formData.title} onChange={handleChange} placeholder={t('title_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('phone_number')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.phone_number}
                    disabled
                    className="flex-1 bg-slate-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={openPhoneOTPModal}
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    {t('change') || "O'zgartirish"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">{t('phone_number')}</Label>
              <Input id="phone_number" value={formatPhoneInput(formData.phone_number)} onChange={(e) => setFormData(prev => ({ ...prev, phone_number: parsePhoneInput(e.target.value) }))} placeholder="+998 XX XXX XXXX" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('bio')}</Label>
            <Textarea id="bio" value={formData.bio} onChange={handleChange} placeholder={t('bio_placeholder')} />
          </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{t('bio')}</Label>
              <Textarea id="bio" value={formData.bio} onChange={handleChange} placeholder={t('bio_placeholder')} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('saving')}</> : t('save_changes')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Phone OTP Verification Modal */}
      <Dialog open={showPhoneOTP} onOpenChange={setShowPhoneOTP}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              {t('change_phone_number') || 'Telefon raqamni o\'zgartirish'}
            </DialogTitle>
            <DialogDescription>
              {t('phone_otp_description') || 'Yangi telefon raqamingizga tasdiqlash kodi yuboriladi'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Phone input */}
            <div className="space-y-2">
              <Label>{t('new_phone_number') || 'Yangi telefon raqam'}</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+998 XX XXX XX XX"
                disabled={otpSent && otpCountdown > 0}
              />
            </div>

            {/* Send OTP button */}
            {!otpSent ? (
              <Button
                onClick={handleSendOTP}
                disabled={otpSending}
                className="w-full"
              >
                {otpSending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('sending') || 'Yuborilmoqda...'}</>
                ) : (
                  t('send_otp') || 'Tasdiqlash kodini yuborish'
                )}
              </Button>
            ) : (
              <>
                {/* OTP input */}
                <div className="space-y-3">
                  <Label className="text-center block">
                    {t('enter_otp_code') || 'Tasdiqlash kodini kiriting'}
                  </Label>
                  <div className="flex justify-center gap-2" onPaste={handleOTPPaste}>
                    {otpCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => otpRefs.current[i] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(i, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(i, e)}
                        className="w-11 h-12 text-center text-lg font-bold border-2 border-slate-200 rounded-lg
                          focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        disabled={otpVerifying}
                      />
                    ))}
                  </div>
                </div>

                {/* Error */}
                {otpError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {otpError}
                  </div>
                )}

                {/* Verify button */}
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otpVerifying || otpCode.join('').length !== 6}
                  className="w-full"
                >
                  {otpVerifying ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('verifying') || 'Tekshirilmoqda...'}</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> {t('verify_and_save') || 'Tasdiqlash va saqlash'}</>
                  )}
                </Button>

                {/* Resend */}
                <div className="text-center">
                  {otpCountdown > 0 ? (
                    <p className="text-sm text-slate-500">
                      {t('resend_in') || 'Qayta yuborish'}: <span className="font-medium text-blue-600">{otpCountdown}{t('seconds_short') || 's'}</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={otpSending}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      {t('resend_otp') || 'Kodni qayta yuborish'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
