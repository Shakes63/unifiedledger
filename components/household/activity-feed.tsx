'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { toast } from 'sonner';
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
  transaction_created: 'text-blue-400',
  transaction_updated: 'text-yellow-400',
  transaction_deleted: 'text-red-400',
  bill_created: 'text-blue-400',
  bill_updated: 'text-yellow-400',
  bill_deleted: 'text-red-400',
  bill_paid: 'text-green-400',
  goal_created: 'text-emerald-400',
  goal_updated: 'text-yellow-400',
  goal_deleted: 'text-red-400',
  goal_completed: 'text-green-400',
  debt_created: 'text-red-400',
  debt_updated: 'text-yellow-400',
  debt_deleted: 'text-red-400',
  debt_paid: 'text-green-400',
  debt_payoff_milestone: 'text-purple-400',
  member_added: 'text-blue-400',
  member_removed: 'text-red-400',
  member_left: 'text-red-400',
  transfer_created: 'text-cyan-400',
  transfer_deleted: 'text-red-400',
};

interface ActivityFeedProps {
  householdId: string;
  limit?: number;
}

export function ActivityFeed({ householdId, limit = 20 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<any[]>([]);
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
      <Card className="bg-card border-border p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading activity...</p>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">No activity yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-3 py-3 border-b border-border last:border-b-0"
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
              className={`flex items-center justify-center w-6 h-6 rounded-full bg-elevated shrink-0 ${
                ACTIVITY_COLORS[activity.activityType] || 'text-muted-foreground'
              }`}
            >
              {ACTIVITY_ICONS[activity.activityType] || <Zap className="w-3 h-3" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{activity.userName || 'Unknown User'}</span>
                    {' '}
                    <span className="text-muted-foreground">{activity.description}</span>
                  </p>
                  {activity.metadata && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Object.entries(activity.metadata)
                        .slice(0, 2)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' • ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
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
