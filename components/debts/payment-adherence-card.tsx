'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface AdherenceData {
  hasDebts: boolean;
  hasHistory: boolean;
  overallStatus?: 'on_track' | 'ahead' | 'behind' | 'significantly_behind';
  overallAdherence?: number;
  monthsTracked?: number;
  monthsOnTrack?: number;
  monthsAhead?: number;
  monthsBehind?: number;
  projectionAdjustment?: {
    monthsAheadOrBehind: number;
    savingsFromBeingAhead?: number;
    additionalCostFromBehind?: number;
  } | null;
  message?: string;
}

export function PaymentAdherenceCard() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchAdherenceData = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/debts/adherence');

      if (!response.ok) {
        throw new Error('Failed to fetch adherence data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching payment adherence:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchAdherenceData();
  }, [selectedHouseholdId, fetchAdherenceData]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ahead':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          text: 'text-emerald-400',
          icon: TrendingUp,
        };
      case 'on_track':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          icon: Minus,
        };
      case 'behind':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          icon: TrendingDown,
        };
      case 'significantly_behind':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: AlertCircle,
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          text: 'text-gray-400',
          icon: Minus,
        };
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'ahead':
        return 'Ahead of Schedule';
      case 'on_track':
        return 'On Track';
      case 'behind':
        return 'Behind Schedule';
      case 'significantly_behind':
        return 'Significantly Behind';
      default:
        return 'Unknown';
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-6 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
        </div>
      </Card>
    );
  }

  // No debts
  if (!data?.hasDebts) {
    return null; // Don't show if no debts
  }

  // No payment history yet
  if (!data.hasHistory) {
    return (
      <Card className="p-6 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>Payment Adherence</h3>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Track your payment consistency</p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-accent) 20%, transparent)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {data.message || 'Make your first payment to start tracking adherence!'}
        </p>
      </Card>
    );
  }

  const statusColors = getStatusColor(data.overallStatus);
  const StatusIcon = statusColors.icon;

  return (
    <Card className="p-6 rounded-xl" style={{ border: `1px solid ${statusColors.border}`, backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>Payment Adherence</h3>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {data.monthsOnTrack} of {data.monthsTracked} months on track
          </p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: statusColors.bg }}>
          <StatusIcon className="w-5 h-5" style={{ color: statusColors.text }} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="flex items-end gap-4 mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" style={{ color: statusColors.text }}>
              {data.overallAdherence}%
            </span>
          </div>
          <span
            className="text-xs px-2 py-1 rounded-full inline-block mt-2"
            style={{ backgroundColor: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}
          >
            {getStatusLabel(data.overallStatus)}
          </span>
        </div>

        {/* Projection adjustment */}
        {data.projectionAdjustment && data.projectionAdjustment.monthsAheadOrBehind !== 0 && (
          <div className="flex-1">
            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Impact</p>
            <p
              className="text-sm font-semibold"
              style={{ color: data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
            >
              {Math.abs(data.projectionAdjustment.monthsAheadOrBehind)} month
              {Math.abs(data.projectionAdjustment.monthsAheadOrBehind) !== 1 ? 's' : ''}{' '}
              {data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'ahead' : 'behind'}
            </p>
            {data.projectionAdjustment.savingsFromBeingAhead && (
              <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
                ${data.projectionAdjustment.savingsFromBeingAhead.toLocaleString()} saved
              </p>
            )}
            {data.projectionAdjustment.additionalCostFromBehind && (
              <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
                ${data.projectionAdjustment.additionalCostFromBehind.toLocaleString()} more interest
              </p>
            )}
          </div>
        )}
      </div>

      {/* Monthly breakdown summary */}
      <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>On Track</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>{data.monthsOnTrack}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Ahead</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-success)' }}>{data.monthsAhead}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Behind</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-warning)' }}>{data.monthsBehind}</p>
        </div>
      </div>

      {/* Toggle Details Button */}
      <Button
        onClick={() => setExpanded(!expanded)}
        variant="ghost"
        className="w-full mt-4 [&:hover]:bg-[var(--color-elevated)]"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4 mr-2" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 mr-2" />
            View Details
          </>
        )}
      </Button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Your payment adherence tracks how consistently you meet your debt payment goals based on your current extra payment settings.
          </p>
          <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Months Tracked:</span>
              <span style={{ color: 'var(--color-foreground)' }}>{data.monthsTracked}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Average Adherence:</span>
              <span style={{ color: 'var(--color-foreground)' }}>{data.overallAdherence}%</span>
            </div>
            {data.projectionAdjustment && (
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Projection Adjustment:</span>
                <span style={{ color: data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}>
                  {data.projectionAdjustment.monthsAheadOrBehind > 0 ? '+' : ''}
                  {data.projectionAdjustment.monthsAheadOrBehind} months
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
