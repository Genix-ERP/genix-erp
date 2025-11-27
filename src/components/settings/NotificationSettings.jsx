import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, BellRing, Trash2, CheckCheck } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function NotificationSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      const userNotifications = await base44.entities.Notification.filter({ user_id: currentUser.id }, "-created_date", 50);
      setNotifications(userNotifications);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    const originalNotifications = [...notifications];
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await base44.entities.Notification.update(id, { is_read: true });
    } catch (error) {
      console.error("Failed to mark as read", error);
      setNotifications(originalNotifications);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if(unreadIds.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await Promise.all(unreadIds.map(id => base44.entities.Notification.update(id, { is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read", error);
      fetchNotifications();
    }
  };

  const handleDelete = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await base44.entities.Notification.delete(id);
    } catch (error) {
      console.error("Failed to delete notification", error);
      fetchNotifications();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notifications')}</CardTitle>
        <CardDescription>{t('notifications_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('recent_notifications')}</h3>
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t('mark_all_read')}
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <Bell className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4">{t('no_notifications')}</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4">
            {notifications.map(notification => (
              <div key={notification.id} className={`p-4 rounded-lg flex items-start gap-4 ${notification.is_read ? 'bg-slate-50' : 'bg-blue-50'}`}>
                <div className="mt-1">
                  <BellRing className={`w-5 h-5 ${notification.is_read ? 'text-slate-400' : 'text-blue-500'}`} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{notification.title}</h4>
                  <p className="text-sm text-slate-600">{notification.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(notification.created_date).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {!notification.is_read && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>{t('mark_as_read')}</Button>
                  )}
                   <Button variant="ghost" size="icon" onClick={() => handleDelete(notification.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}