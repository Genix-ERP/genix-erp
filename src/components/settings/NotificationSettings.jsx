import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, BellRing, CheckCheck, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { renderNotification } from "@/utils/notificationCatalog";
import { formatDateTime } from '@/utils/formatDate';

export default function NotificationSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    const tenantId = localStorage.getItem('tenantId');
    const orgId = localStorage.getItem('organizationId');
    return {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId || '',
      'X-Organization-ID': orgId || '',
      'Content-Type': 'application/json',
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/notifications?limit=20`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('Failed to mark as read', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/notifications/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete notification', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notifications')}</CardTitle>
        <CardDescription>{t('notifications_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {t('recent_notifications')}
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({unreadCount} {t('unread') || 'unread'})
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              {t('mark_all_read')}
            </Button>
          )}
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
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {notifications.map(notification => {
              // Run through the catalog so the title/message render
              // in the user's current language (EN/UZ/RU). Falls back
              // to the stored title/message when the type isn't in
              // the catalog yet — those values were frozen at the
              // user's profile language at creation time.
              const display = renderNotification(notification, t, language);
              return (
              <div key={notification.id} className={`p-4 rounded-lg flex items-start gap-4 transition-colors ${notification.is_read ? 'bg-slate-50' : 'bg-blue-50 border border-blue-100'}`}>
                <div className="mt-1">
                  <BellRing className={`w-5 h-5 ${notification.is_read ? 'text-slate-400' : 'text-blue-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{display.title}</h4>
                  <p className="text-sm text-slate-600 mt-0.5">{display.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {notification.type && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-medium">
                        {t(`notif_type_${notification.type}`) !== `notif_type_${notification.type}`
                          ? t(`notif_type_${notification.type}`)
                          : (t(notification.type) !== notification.type
                              ? t(notification.type)
                              : notification.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                      </span>
                    )}
                    <p className="text-xs text-slate-400">{formatDateTime(notification.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!notification.is_read && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleMarkAsRead(notification.id)}>
                      {t('mark_as_read')}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(notification.id)} className="text-slate-400 hover:text-red-500 h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
