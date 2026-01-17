import React, { useState, useEffect } from "react";
import { Notification } from "@/api/entities";
import { useAuth } from "@/components/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  BellRing, 
  AlertTriangle,
  Info,
  CheckCircle,
  Sparkles,
  Filter
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [typeFilter, setTypeFilter] = useState("all"); // all, info, warning, success, alert
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  useEffect(() => {
    filterNotifications();
  }, [notifications, filter, typeFilter]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const allNotifications = await Notification.list("-created_date", 100);

      // Filter notifications for current user or system-wide
      const userNotifications = allNotifications.filter(
        n => n.user_id === currentUser?.id || n.user_id === "system"
      );

      setNotifications(userNotifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
    setIsLoading(false);
  };

  const filterNotifications = () => {
    let filtered = notifications;

    // Filter by read status
    if (filter === "unread") {
      filtered = filtered.filter(n => !n.is_read);
    } else if (filter === "read") {
      filtered = filtered.filter(n => n.is_read);
    }

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    setFilteredNotifications(filtered);
  };

  const handleMarkAsRead = async (id) => {
    try {
      await Notification.update(id, { is_read: true });
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      await Promise.all(unreadIds.map(id => 
        Notification.update(id, { is_read: true })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await Notification.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(t('confirm_delete_all') || 'Delete all notifications?')) return;
    
    try {
      await Promise.all(notifications.map(n => Notification.delete(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "update":
        return <Sparkles className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "success":
        return "bg-green-100 text-green-800";
      case "alert":
        return "bg-red-100 text-red-800";
      case "update":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-8 h-8 text-[var(--genix-navy)]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-[var(--genix-navy)]">{t('notifications')}</h1>
            </div>
            <p className="text-slate-600 mt-2">
              {unreadCount > 0 
                ? `${unreadCount} ${t('unread_notifications') || 'unread notifications'}`
                : t('all_caught_up') || 'You\'re all caught up!'}
            </p>
          </div>
          
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button 
                onClick={handleMarkAllAsRead}
                variant="outline"
                className="flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                {t('mark_all_read')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                onClick={handleDeleteAll}
                variant="outline"
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                {t('delete_all') || 'Delete All'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('total')}</p>
                  <p className="text-2xl font-bold text-slate-900">{notifications.length}</p>
                </div>
                <Bell className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('unread')}</p>
                  <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
                </div>
                <BellRing className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('alerts')}</p>
                  <p className="text-2xl font-bold text-red-600">
                    {notifications.filter(n => n.type === 'alert').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('updates')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {notifications.filter(n => n.type === 'update').length}
                  </p>
                </div>
                <Sparkles className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Status Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{t('status')}:</span>
                </div>
                <Tabs value={filter} onValueChange={setFilter} className="w-full">
                  <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-wrap justify-start gap-1 h-auto">
                    <TabsTrigger value="all" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('all')} ({notifications.length})</TabsTrigger>
                    <TabsTrigger value="unread" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('unread')} ({unreadCount})</TabsTrigger>
                    <TabsTrigger value="read" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('read')} ({notifications.length - unreadCount})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Type Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{t('type')}:</span>
                </div>
                <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
                  <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-wrap justify-start gap-1 h-auto">
                    <TabsTrigger value="all" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('all_types') || 'All'}</TabsTrigger>
                    <TabsTrigger value="info" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('info')}</TabsTrigger>
                    <TabsTrigger value="warning" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('warning')}</TabsTrigger>
                    <TabsTrigger value="success" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('success')}</TabsTrigger>
                    <TabsTrigger value="alert" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('alert')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              {t('recent_notifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300 animate-pulse" />
                    <p className="text-slate-500">{t('loading')}...</p>
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-lg font-medium">{t('no_notifications')}</p>
                    <p className="text-slate-400 text-sm mt-2">
                      {t('notifications_appear_here') || 'New notifications will appear here'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 hover:bg-slate-50 transition-colors",
                        !notification.is_read && "bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {getTypeIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">{notification.title}</h4>
                            {!notification.is_read && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                {t('new')}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                          
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <Badge variant="outline" className={getTypeColor(notification.type)}>
                              {notification.type}
                            </Badge>
                            <span>{new Date(notification.created_date).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
