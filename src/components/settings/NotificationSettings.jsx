import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, BellRing, Trash2, CheckCheck } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function NotificationSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    // Demo notifications - use translation keys for title and message
    const demoNotifications = [
      {
        id: '1',
        titleKey: 'notification_welcome_title',
        messageKey: 'notification_welcome_message',
        is_read: false,
        created_date: new Date().toISOString()
      },
      {
        id: '2',
        titleKey: 'notification_system_update_title',
        messageKey: 'notification_system_update_message',
        is_read: true,
        created_date: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    setNotifications(demoNotifications);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUser]);

  const handleMarkAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
                  <h4 className="font-semibold">{t(notification.titleKey) || notification.title}</h4>
                  <p className="text-sm text-slate-600">{t(notification.messageKey) || notification.message}</p>
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