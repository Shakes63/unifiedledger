'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Link from 'next/link';
import { toast } from 'sonner';

interface Notification {
  id: string;
  userId: string;
  householdId?: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  isDismissed: boolean;
  isActionable: boolean;
  actionLabel?: string;
  scheduledFor?: string;
  sentAt?: string;
  readAt?: string;
  dismissedAt?: string;
  expiresAt?: string;
  metadata?: string;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10&unreadOnly=true');
      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDismissed: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
        if (unreadCount > 0) {
          setUnreadCount(unreadCount - 1);
        }
      }
    } catch (error) {
      console.error('Error dismissing notification:', error);
      toast.error('Failed to dismiss notification');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-500/10';
      case 'high':
        return 'border-amber-500 bg-amber-500/10';
      case 'normal':
        return 'border-blue-500 bg-blue-500/10';
      default:
        return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      bill_due: '📅',
      bill_overdue: '⚠️',
      budget_warning: '💰',
      budget_exceeded: '❌',
      low_balance: '📉',
      savings_milestone: '🎉',
      debt_milestone: '✅',
      spending_summary: '📊',
      reminder: '🔔',
      system: 'ℹ️',
    };
    return emojis[type] || '🔔';
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-gray-400 hover:text-white hover:bg-[#242424]"
        onClick={() => setIsOpen(true)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1 -translate-y-1 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-96 bg-[#0a0a0a] border-[#2a2a2a]">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <SheetDescription className="text-gray-400">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Notifications List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-l-4 rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer ${getPriorityColor(
                    notification.priority
                  )}`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getTypeEmoji(notification.type)}
                        </span>
                        <p className="font-medium text-white text-sm truncate">
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.isActionable && notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                            setIsOpen(false);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                        >
                          {notification.actionLabel || 'View'}
                        </Link>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(notification.id);
                      }}
                      className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#2a2a2a] mt-4 pt-4">
            <Link
              href="/dashboard/notifications"
              className="block text-center text-sm text-blue-400 hover:text-blue-300 py-2"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
