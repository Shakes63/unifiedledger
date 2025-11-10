'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, Trash2, Archive, CheckCircle2, Calendar, DollarSign, BarChart3, TrendingDown, PartyPopper, Bell, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchNotifications();
  }, [filter, page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/notifications', window.location.origin);
      url.searchParams.append('limit', String(limit));
      url.searchParams.append('offset', String(page * limit));
      if (filter === 'unread') {
        url.searchParams.append('unreadOnly', 'true');
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      setNotifications(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

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
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to update notification');
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
        setTotal(Math.max(0, total - 1));
      }
    } catch (error) {
      console.error('Error dismissing notification:', error);
      toast.error('Failed to dismiss notification');
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
        setTotal(Math.max(0, total - 1));
        toast.success('Notification deleted');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-[var(--color-error)]/20 text-[var(--color-error)] border-[var(--color-error)]/30';
      case 'high':
        return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/30';
      case 'normal':
        return 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30';
      default:
        return 'bg-muted/20 text-muted-foreground border-border';
    }
  };

  const getTypeIcon = (type: string) => {
    const iconClass = "w-6 h-6";
    switch (type) {
      case 'bill_due':
      case 'bill_overdue':
        return <Calendar className={`${iconClass} text-[var(--color-warning)]`} />;
      case 'budget_warning':
      case 'budget_exceeded':
        return <DollarSign className={`${iconClass} text-[var(--color-error)]`} />;
      case 'budget_review':
        return <BarChart3 className={`${iconClass} text-[var(--color-primary)]`} />;
      case 'low_balance':
        return <TrendingDown className={`${iconClass} text-[var(--color-error)]`} />;
      case 'savings_milestone':
      case 'debt_milestone':
        return <PartyPopper className={`${iconClass} text-[var(--color-success)]`} />;
      case 'spending_summary':
        return <BarChart3 className={`${iconClass} text-[var(--color-primary)]`} />;
      case 'reminder':
        return <Bell className={`${iconClass} text-[var(--color-primary)]`} />;
      default:
        return <Info className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
        <p className="text-muted-foreground mt-2">All your notifications in one place</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => {
            setFilter('all');
            setPage(0);
          }}
          className={filter === 'all' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-border text-muted-foreground hover:text-foreground'}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          onClick={() => {
            setFilter('unread');
            setPage(0);
          }}
          className={filter === 'unread' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-border text-muted-foreground hover:text-foreground'}
        >
          Unread
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <div className="h-8 w-8 border-4 border-border border-t-[var(--color-primary)] rounded-full" />
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <Card className="bg-background border-border">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`bg-background border-border hover:border-border transition-colors ${
                !notification.isRead ? 'border-l-4 border-l-[var(--color-primary)]' : ''
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">{getTypeIcon(notification.type)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-foreground">
                            {notification.title}
                          </h3>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${getPriorityBadgeColor(
                              notification.priority
                            )}`}
                          >
                            {notification.priority}
                          </span>
                          {!notification.isRead && (
                            <span className="text-xs text-[var(--color-primary)]">New</span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {format(
                              parseISO(notification.createdAt),
                              'MMM d, yyyy h:mm a'
                            )}
                          </p>

                          {notification.isActionable && notification.actionUrl && (
                            <a
                              href={notification.actionUrl}
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary)]/80"
                            >
                              {notification.actionLabel || 'View'}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(notification.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Dismiss"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                            className="text-muted-foreground hover:text-[var(--color-error)]"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
