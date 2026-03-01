'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { toast } from 'sonner';

// Activity entry from the API
interface ActivityLogEntry {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}
import {
  ArrowRightLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Target,
  CreditCard,
  Users,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  transaction_created: <Plus className="w-4 h-4" />,
  transaction_updated: <Edit className="w-4 h-4" />,
  transaction_deleted: <Trash2 className="w-4 h-4" />,
  bill_created: <Plus className="w-4 h-4" />,
  bill_updated: <Edit className="w-4 h-4" />,
  bill_deleted: <Trash2 className="w-4 h-4" />,
  bill_paid: <CheckCircle className="w-4 h-4" />,
  goal_created: <Target className="w-4 h-4" />,
  goal_updated: <Edit className="w-4 h-4" />,
  goal_deleted: <Trash2 className="w-4 h-4" />,
  goal_completed: <CheckCircle className="w-4 h-4" />,
  debt_created: <CreditCard className="w-4 h-4" />,
  debt_updated: <Edit className="w-4 h-4" />,
  debt_deleted: <Trash2 className="w-4 h-4" />,
  debt_paid: <CheckCircle className="w-4 h-4" />,
  debt_payoff_milestone: <Zap className="w-4 h-4" />,
  member_added: <Users className="w-4 h-4" />,
  member_removed: <Users className="w-4 h-4" />,
  member_left: <Users className="w-4 h-4" />,
  transfer_created: <ArrowRightLeft className="w-4 h-4" />,
  transfer_deleted: <Trash2 className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  transaction_created: 'var(--color-primary)',
  transaction_updated: 'var(--color-warning)',
  transaction_deleted: 'var(--color-destructive)',
  bill_created: 'var(--color-primary)',
  bill_updated: 'var(--color-warning)',
  bill_deleted: 'var(--color-destructive)',
  bill_paid: 'var(--color-success)',
  goal_created: 'var(--color-success)',
  goal_updated: 'var(--color-warning)',
  goal_deleted: 'var(--color-destructive)',
  goal_completed: 'var(--color-success)',
  debt_created: 'var(--color-destructive)',
  debt_updated: 'var(--color-warning)',
  debt_deleted: 'var(--color-destructive)',
  debt_paid: 'var(--color-success)',
  debt_payoff_milestone: 'var(--color-primary)',
  member_added: 'var(--color-primary)',
  member_removed: 'var(--color-destructive)',
  member_left: 'var(--color-destructive)',
  transfer_created: 'var(--color-primary)',
  transfer_deleted: 'var(--color-destructive)',
};

interface ActivityFeedProps {
  householdId: string;
  limit?: number;
}

export function ActivityFeed({ householdId, limit = 20 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/households/${householdId}/activity-log?limit=${limit}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data.data);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activity feed');
    } finally {
      setLoading(false);
    }
  }, [householdId, limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  if (loading) {
    return (
      <Card className="p-6" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="text-center py-8">
          <p style={{ color: 'var(--color-muted-foreground)' }}>Loading activity...</p>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-6" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="text-center py-8">
          <p style={{ color: 'var(--color-muted-foreground)' }}>No activity yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-3 py-3 last:border-b-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            {/* User Avatar */}
            <UserAvatar
              userId={activity.userId}
              userName={activity.userName || 'Unknown User'}
              avatarUrl={activity.userAvatarUrl}
              size="sm"
              className="shrink-0"
            />

            {/* Activity Type Icon */}
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--color-elevated)', color: ACTIVITY_COLORS[activity.activityType] || 'var(--color-muted-foreground)' }}
            >
              {ACTIVITY_ICONS[activity.activityType] || <Zap className="w-3 h-3" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                    <span className="font-semibold">{activity.userName || 'Unknown User'}</span>
                    {' '}
                    <span style={{ color: 'var(--color-muted-foreground)' }}>{activity.description}</span>
                  </p>
                  {activity.metadata && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                      {Object.entries(activity.metadata)
                        .slice(0, 2)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' • ')}
                    </p>
                  )}
                </div>
                <span className="text-xs whitespace-nowrap shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                  {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
