import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { renderNotification } from "@/utils/notificationCatalog";
import { createPageUrl } from "@/utils";
import apiClient from "@/api/client";

// Bell icon in the app header. Shows an unread badge, opens a dropdown
// listing the 10 most recent notifications, and polls every 30s so a
// new reminder lights up the badge without a page refresh.
//
// Why a custom component instead of a Link to /notifications:
// users want at-a-glance awareness ("there's something new") plus a
// quick way to dismiss/jump to a single notification, without losing
// their current page. The full /notifications page is still reachable
// via the "View all" footer link for filtering / mass-management.

const POLL_INTERVAL_MS = 30 * 1000;       // 30s — fresh-enough without spam
const RECENT_LIMIT = 10;                  // dropdown shows the 10 most recent

export default function NotificationBell() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Cache the latest fetch's AbortController so a slow request can be
  // cancelled if the user clicks the bell again or the page unmounts.
  const abortRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await apiClient.get('/notifications', {
        params: { limit: RECENT_LIMIT },
        signal: ctrl.signal,
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setItems(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.warn('Failed to fetch notifications:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Lightweight unread-count poller — runs every 30s in the background
  // even when the dropdown is closed, so the red badge stays accurate.
  // We hit /unread-count instead of /notifications to keep the round
  // trip cheap.
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      // Backend may return the count as either { data: { count: N } }
      // or { data: N } depending on which version of the handler is
      // deployed; tolerate both rather than assuming.
      const count = typeof res.data?.data === 'number'
        ? res.data.data
        : (res.data?.data?.count ?? 0);
      setUnreadCount(count);
    } catch (err) {
      // Silent — failures here just mean the badge won't refresh, not
      // a blocking error for the user.
    }
  }, []);

  // First load + 30s poll loop.
  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // When the user opens the dropdown, fetch the latest list. We don't
  // do this on every render because the user may sit with the bell
  // open for a long time while reading.
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = async (id) => {
    // Optimistic — flip the row immediately, then sync with backend.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (err) {
      console.warn('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await apiClient.put('/notifications/read-all');
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  // Click handler for a notification row. Marks it read, then deep-
  // links to the related entity if one is encoded in `data`.
  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    setOpen(false);

    // Best-effort deep linking. The CRM activity reminder packs
    // lead_id; future emitters can add their own routes here.
    let data = n.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    if (n.type === 'crm_activity_reminder' && data?.lead_id) {
      navigate(`${createPageUrl('Customers')}?tab=leads&lead_id=${data.lead_id}`);
      return;
    }
    // Fallback: just go to the full notifications page.
    navigate(createPageUrl('Notifications'));
  };

  const renderItem = (n) => {
    const display = renderNotification(n, t, language);
    const created = n.created_at ? new Date(n.created_at) : null;
    return (
      <div
        key={n.id}
        className={`group relative px-3 py-3 border-b last:border-b-0 cursor-pointer transition-colors ${
          n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'
        }`}
        onClick={() => handleNotificationClick(n)}
      >
        <div className="flex items-start gap-2">
          {!n.is_read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
          )}
          <div className={`flex-1 min-w-0 ${n.is_read ? 'pl-4' : ''}`}>
            <div className="text-sm font-medium text-slate-800 truncate">
              {display.title}
            </div>
            {display.body && (
              <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                {display.body}
              </div>
            )}
            {created && (
              <div className="text-[10px] text-slate-400 mt-1">
                {created.toLocaleString(undefined, { hour12: false })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-slate-100 rounded-full transition-all duration-200"
          title={t('notifications') || 'Notifications'}
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 overflow-hidden flex flex-col"
      >
        {/* Header — title on its own line so long translations
            (Uzbek "Hammasini o'qilgan deb belgilash") don't collide
            with the action button. The "mark all read" lives on the
            right as an icon-only button with a tooltip; the unread
            count sits under the title in muted text. */}
        <div className="px-3 py-2.5 border-b bg-slate-50 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">
              {t('notifications') || 'Notifications'}
            </div>
            {unreadCount > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                {unreadCount} {t('unread') || 'unread'}
              </div>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={markAllRead}
              title={t('mark_all_read') || 'Mark all read'}
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Scrollable list — plain div + overflow-y-auto so it
            actually scrolls. ScrollArea (radix) needs an explicit
            fixed height to render scrollbars and was silently
            stretching to fit content here. */}
        <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
          {loading && items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {t('loading') || 'Loading...'}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-600">
                {t('no_notifications') || 'No notifications yet'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {t('no_notifications_hint') || "We'll let you know when something happens"}
              </div>
            </div>
          ) : (
            items.map(renderItem)
          )}
        </div>

        <div className="border-t bg-slate-50 flex-shrink-0">
          <Link
            to={createPageUrl('Notifications')}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
          >
            {t('view_all_notifications') || 'View all notifications'}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
