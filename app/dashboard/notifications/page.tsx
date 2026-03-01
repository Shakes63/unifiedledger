'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  Trash2,
  Archive,
  CheckCircle2,
  Calendar,
  DollarSign,
  BarChart3,
  TrendingDown,
  PartyPopper,
  Bell,
  Info,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  isDismissed: boolean;
  isActionable: boolean;
  actionLabel?: string;
  createdAt: string;
}

// ── Type + priority helpers ───────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-error)',
  high:   'var(--color-warning)',
  normal: 'var(--color-primary)',
  low:    'var(--color-muted-foreground)',
};

interface TypeMeta {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function getTypeMeta(type: string): TypeMeta {
  switch (type) {
    case 'bill_due':          return { Icon: Calendar,      color: 'var(--color-warning)' };
    case 'bill_overdue':      return { Icon: AlertTriangle,  color: 'var(--color-error)' };
    case 'budget_warning':    return { Icon: DollarSign,     color: 'var(--color-warning)' };
    case 'budget_exceeded':   return { Icon: XCircle,        color: 'var(--color-error)' };
    case 'budget_review':     return { Icon: BarChart3,      color: 'var(--color-primary)' };
    case 'low_balance':       return { Icon: TrendingDown,   color: 'var(--color-error)' };
    case 'savings_milestone':
    case 'debt_milestone':    return { Icon: PartyPopper,    color: 'var(--color-income)' };
    case 'spending_summary':  return { Icon: BarChart3,      color: 'var(--color-primary)' };
    case 'reminder':          return { Icon: Bell,           color: 'var(--color-primary)' };
    default:                  return { Icon: Info,           color: 'var(--color-muted-foreground)' };
  }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);
    if (diffMins < 1)   return 'just now';
    if (diffMins < 60)  return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7)   return `${diffDays}d ago`;
    return format(d, 'MMM d');
  } catch { return '—'; }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-border)', backgroundColor: 'var(--color-background)', animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="w-4 h-4 shrink-0 mt-1" />
        <div className="w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }} />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-baseline gap-2">
            <div className="h-3.5 rounded w-2/5" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="h-2.5 rounded w-10" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
          <div className="h-2.5 rounded w-4/5" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="h-2.5 rounded w-3/5" style={{ backgroundColor: 'var(--color-elevated)' }} />
        </div>
      </div>
    </div>
  );
}

// ── Notification item ─────────────────────────────────────────────────────────
function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { Icon, color } = getTypeMeta(notification.type);
  const priorityColor = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.low;
  const isUnread = !notification.isRead;

  return (
    <div
      className="group overflow-hidden transition-shadow duration-150"
      style={{
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${priorityColor}`,
        backgroundColor: isUnread
          ? `color-mix(in oklch, ${priorityColor} 3%, var(--color-card))`
          : 'var(--color-card)',
        boxShadow: 'none',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px color-mix(in oklch, ${priorityColor} 8%, transparent)`)}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Unread dot */}
        <div className="w-4 shrink-0 flex items-center justify-center mt-1.5">
          {isUnread && (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
          )}
        </div>

        {/* Type icon badge */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + date */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-[13px] truncate flex-1"
              style={{
                color: 'var(--color-foreground)',
                fontWeight: isUnread ? 600 : 500,
              }}
            >
              {notification.title}
            </span>
            <span
              className="text-[10px] font-mono tabular-nums shrink-0"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {formatRelativeDate(notification.createdAt)}
            </span>
          </div>

          {/* Message */}
          <p
            className="text-[12px] leading-relaxed line-clamp-2"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {notification.message}
          </p>

          {/* Footer row */}
          <div className="flex items-center mt-2 gap-2">
            {/* Priority pill (urgent / high only) */}
            {(notification.priority === 'urgent' || notification.priority === 'high') && (
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-px rounded shrink-0"
                style={{
                  backgroundColor: `color-mix(in oklch, ${priorityColor} 14%, transparent)`,
                  color: priorityColor,
                }}
              >
                {notification.priority}
              </span>
            )}

            {/* Action link */}
            {notification.isActionable && notification.actionUrl && (
              <Link
                href={notification.actionUrl}
                onClick={() => onMarkRead(notification.id)}
                className="text-[11px] font-medium transition-opacity hover:opacity-70 shrink-0"
                style={{ color: priorityColor }}
              >
                {notification.actionLabel || 'View'} →
              </Link>
            )}

            {/* Actions — hover revealed */}
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isUnread && (
                <button
                  onClick={() => onMarkRead(notification.id)}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                  style={{ color: 'var(--color-muted-foreground)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-income) 10%, transparent)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-income)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                  }}
                  title="Mark as read"
                >
                  <CheckCircle2 className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => onDismiss(notification.id)}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                }}
                title="Dismiss"
              >
                <Archive className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(notification.id)}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                }}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const url = new URL('/api/notifications', window.location.origin);
        url.searchParams.append('limit', String(limit));
        url.searchParams.append('offset', String(page * limit));
        if (filter === 'unread') url.searchParams.append('unreadOnly', 'true');
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        if (cancelled) return;
        setNotifications(data.data || []);
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
      } catch {
        toast.error('Failed to load notifications');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [filter, page]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch { toast.error('Failed to update notification'); }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDismissed: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setTotal(t => Math.max(0, t - 1));
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch { toast.error('Failed to dismiss notification'); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setTotal(t => Math.max(0, t - 1));
        toast.success('Notification deleted');
      }
    } catch { toast.error('Failed to delete notification'); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard">
              <button
                className="h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              Notifications
            </h1>

            {unreadCount > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}

            <div className="flex-1" />

            {/* Filter toggle */}
            <div
              className="flex rounded-lg overflow-hidden shrink-0"
              style={{ border: '1px solid var(--color-border)' }}
            >
              {(['all', 'unread'] as const).map((f, i) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(0); }}
                  className="px-3 py-1 text-[11px] font-medium capitalize transition-colors"
                  style={{
                    backgroundColor: filter === f ? 'var(--color-primary)' : 'transparent',
                    color: filter === f ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                    borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {f === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>

            {/* Total count */}
            {total > 0 && (
              <span
                className="text-[11px] font-mono tabular-nums shrink-0 hidden sm:block"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {total} total
              </span>
            )}
          </div>
        </div>
        {/* Accent line */}
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-2">

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} delay={i * 60} />
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && notifications.length === 0 && (
          <div
            className="rounded-xl py-16 text-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
            >
              <Bell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>
              {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : 'Notifications about bills, budgets, and milestones will appear here.'}
            </p>
            {filter === 'unread' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 text-[12px] underline"
                style={{ color: 'var(--color-primary)' }}
              >
                View all notifications
              </button>
            )}
          </div>
        )}

        {/* ── Notification list ─────────────────────────────────────────────── */}
        {!loading && notifications.length > 0 && (
          <>
            <div className="space-y-2">
              {notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkAsRead}
                  onDismiss={handleDismiss}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl mt-2"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
              >
                <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-30"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'transparent' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)'; }}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-30"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'transparent' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)'; }}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
