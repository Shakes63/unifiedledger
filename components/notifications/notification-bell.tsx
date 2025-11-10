'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  AlertTriangle,
  DollarSign,
  XCircle,
  TrendingDown,
  PartyPopper,
  CheckCircle2,
  BarChart3,
  Info,
  X
} from 'lucide-react';
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
        return 'border-[var(--color-error)] bg-[var(--color-error)]/10';
      case 'high':
        return 'border-[var(--color-warning)] bg-[var(--color-warning)]/10';
      case 'normal':
        return 'border-[var(--color-primary)] bg-[var(--color-primary)]/10';
      default:
        return 'border-border bg-muted/10';
    }
  };

  const getTypeIcon = (type: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      bill_due: Calendar,
      bill_overdue: AlertTriangle,
      budget_warning: DollarSign,
      budget_exceeded: XCircle,
      low_balance: TrendingDown,
      savings_milestone: PartyPopper,
      debt_milestone: CheckCircle2,
      spending_summary: BarChart3,
      reminder: Bell,
      system: Info,
    };
    return iconMap[type] || Bell;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground hover:bg-elevated"
        onClick={() => setIsOpen(true)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-[var(--color-card)] transform translate-x-1 -translate-y-1 bg-[var(--color-error)] rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-96 bg-background border-border">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-foreground">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <SheetDescription className="text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Notifications List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const IconComponent = getTypeIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`p-3 border-l-4 rounded hover:bg-card transition-colors cursor-pointer ${getPriorityColor(
                      notification.priority
                    )}`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4 text-foreground flex-shrink-0" />
                          <p className="font-medium text-foreground text-sm truncate">
                            {notification.title}
                          </p>
                        </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
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
                          className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 mt-2 inline-block"
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
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border mt-4 pt-4">
            <Link
              href="/dashboard/notifications"
              className="block text-center text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 py-2"
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
