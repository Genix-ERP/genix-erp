import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function ProfileSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    title: '',
    phone_number: '+998',
    bio: '',
    profile_picture_url: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        title: currentUser.title || '',
        phone_number: currentUser.phone_number || '+998',
        bio: currentUser.bio || '',
        profile_picture_url: currentUser.profile_picture_url || ''
      });
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    // For demo purposes, create a local URL
    const localUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, profile_picture_url: localUrl }));
    setIsUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    // For demo purposes, just show success message
    // In production, this would update the user data
    await new Promise(resolve => setTimeout(resolve, 500));
    toast.success('Profile updated successfully! (Demo mode)');
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
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
              <Input id="email" type="email" value={formData.email} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('title')}</Label>
              <Input id="title" value={formData.title} onChange={handleChange} placeholder={t('title_placeholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">{t('phone_number')}</Label>
              <Input id="phone_number" value={formData.phone_number} onChange={handleChange} placeholder="+998" />
            </div>
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
  );
}