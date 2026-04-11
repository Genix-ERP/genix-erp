import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const API_BASE = 'http://localhost:8080/api/v1';

function getHeaders() {
  const token = localStorage.getItem('accessToken');
  const tenantId = localStorage.getItem('tenantId');
  const orgId = localStorage.getItem('organizationId');
  return {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId || '',
    'X-Organization-ID': orgId || '',
    'Content-Type': 'application/json',
  };
}

export default function Notifications() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user: currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let filtered = notifications;
    if (filter === "unread") {
      filtered = filtered.filter(n => !n.is_read);
    } else if (filter === "read") {
      filtered = filtered.filter(n => n.is_read);
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter(n => n.type === typeFilter);
    }
    setFilteredNotifications(filtered);
  }, [notifications, filter, typeFilter]);

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "invoice_sent":
      case "purchase_invoice_created":
      case "purchase_invoice_confirmed":
      case "credit_note_created":
        return <Info className="w-5 h-5 text-blue-500" />;
      case "payment_confirmed":
      case "payment_received":
      case "payment_recorded":
      case "expense_approved":
      case "salary_confirmed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "sales_order_confirmed":
      case "purchase_order_approved":
        return <Sparkles className="w-5 h-5 text-purple-500" />;
      case "invoice_overdue":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "low_stock":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "payment_confirmed":
      case "payment_received":
      case "payment_recorded":
      case "expense_approved":
      case "salary_confirmed":
        return "bg-green-100 text-green-800";
      case "sales_order_confirmed":
      case "purchase_order_approved":
        return "bg-purple-100 text-purple-800";
      case "invoice_overdue":
        return "bg-red-100 text-red-800";
      case "low_stock":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      invoice_sent: t('invoice_sent') || 'Invoice Sent',
      payment_confirmed: t('payment_confirmed') || 'Payment Confirmed',
      payment_received: t('payment_received') || 'Payment Received',
      payment_recorded: t('payment_recorded') || 'Payment Recorded',
      invoice_overdue: t('invoice_overdue') || 'Invoice Overdue',
      credit_note_created: t('credit_note_created') || 'Credit Note Created',
      low_stock: t('low_stock_warning') || 'Low Stock',
      purchase_invoice_created: t('purchase_invoice_created') || 'Purchase Invoice Created',
      purchase_invoice_confirmed: t('purchase_invoice_confirmed') || 'Purchase Invoice Confirmed',
      expense_approved: t('expense_approved') || 'Expense Approved',
      salary_confirmed: t('salary_confirmed') || 'Salary Confirmed',
      sales_order_confirmed: t('sales_order_confirmed') || 'Sales Order Confirmed',
      purchase_order_approved: t('purchase_order_approved') || 'Purchase Order Approved',
    };
    return labels[type] || type;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Get unique types for filter
  const notifTypes = [...new Set(notifications.map(n => n.type))];

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header with Action Buttons */}
        <div className="flex justify-between items-center gap-4">
          <p className="text-slate-600">
            {unreadCount > 0
              ? `${unreadCount} ${t('unread_notifications') || 'unread notifications'}`
              : t('all_caught_up') || "You're all caught up!"}
          </p>

          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="outline"
                className="flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                {t('mark_all_read') || 'Mark all read'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-xs text-slate-500">{t('read')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {notifications.length - unreadCount}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
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
                  <span className="text-sm font-medium text-slate-700">{t('status') || 'Status'}:</span>
                </div>
                <Tabs value={filter} onValueChange={setFilter} className="w-full">
                  <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-wrap justify-start gap-1 h-auto">
                    <TabsTrigger value="all" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('all') || 'All'} ({notifications.length})</TabsTrigger>
                    <TabsTrigger value="unread" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('unread') || 'Unread'} ({unreadCount})</TabsTrigger>
                    <TabsTrigger value="read" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('read') || 'Read'} ({notifications.length - unreadCount})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Type Filter */}
              {notifTypes.length > 1 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{t('type') || 'Type'}:</span>
                  </div>
                  <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
                    <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-wrap justify-start gap-1 h-auto">
                      <TabsTrigger value="all" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{t('all_types') || 'All'}</TabsTrigger>
                      {notifTypes.map(type => (
                        <TabsTrigger key={type} value={type} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">{getTypeLabel(type)}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              {t('recent_notifications') || 'Recent Notifications'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300 animate-pulse" />
                    <p className="text-slate-500">{t('loading') || 'Loading'}...</p>
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-lg font-medium">{t('no_notifications') || 'No notifications'}</p>
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
                                {t('new') || 'New'}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-slate-600 mb-2">{notification.message}</p>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <Badge variant="outline" className={getTypeColor(notification.type)}>
                              {getTypeLabel(notification.type)}
                            </Badge>
                            <span>{new Date(notification.created_at).toLocaleString()}</span>
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
