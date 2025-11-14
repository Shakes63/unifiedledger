'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

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
  const [data, setData] = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchAdherenceData();
  }, []);

  const fetchAdherenceData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debts/adherence', { credentials: 'include' });

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
  };

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
      <Card className="p-6 border border-border bg-card rounded-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
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
      <Card className="p-6 border border-border bg-card rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Payment Adherence</h3>
            <p className="text-sm text-muted-foreground">Track your payment consistency</p>
          </div>
          <div className="p-3 bg-accent/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.message || 'Make your first payment to start tracking adherence!'}
        </p>
      </Card>
    );
  }

  const statusColors = getStatusColor(data.overallStatus);
  const StatusIcon = statusColors.icon;

  return (
    <Card className={`p-6 border ${statusColors.border} bg-card rounded-xl`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">Payment Adherence</h3>
          <p className="text-sm text-muted-foreground">
            {data.monthsOnTrack} of {data.monthsTracked} months on track
          </p>
        </div>
        <div className={`p-3 ${statusColors.bg} rounded-lg`}>
          <StatusIcon className={`w-5 h-5 ${statusColors.text}`} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="flex items-end gap-4 mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${statusColors.text}`}>
              {data.overallAdherence}%
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors.bg} ${statusColors.text} border ${statusColors.border} inline-block mt-2`}>
            {getStatusLabel(data.overallStatus)}
          </span>
        </div>

        {/* Projection adjustment */}
        {data.projectionAdjustment && data.projectionAdjustment.monthsAheadOrBehind !== 0 && (
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Impact</p>
            <p className={`text-sm font-semibold ${data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Math.abs(data.projectionAdjustment.monthsAheadOrBehind)} month
              {Math.abs(data.projectionAdjustment.monthsAheadOrBehind) !== 1 ? 's' : ''}{' '}
              {data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'ahead' : 'behind'}
            </p>
            {data.projectionAdjustment.savingsFromBeingAhead && (
              <p className="text-xs text-accent">
                ${data.projectionAdjustment.savingsFromBeingAhead.toLocaleString()} saved
              </p>
            )}
            {data.projectionAdjustment.additionalCostFromBehind && (
              <p className="text-xs text-red-400">
                ${data.projectionAdjustment.additionalCostFromBehind.toLocaleString()} more interest
              </p>
            )}
          </div>
        )}
      </div>

      {/* Monthly breakdown summary */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">On Track</p>
          <p className="text-lg font-semibold text-blue-400">{data.monthsOnTrack}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ahead</p>
          <p className="text-lg font-semibold text-emerald-400">{data.monthsAhead}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Behind</p>
          <p className="text-lg font-semibold text-amber-400">{data.monthsBehind}</p>
        </div>
      </div>

      {/* Toggle Details Button */}
      <Button
        onClick={() => setExpanded(!expanded)}
        variant="ghost"
        className="w-full mt-4 text-muted-foreground hover:text-foreground hover:bg-elevated"
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
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-sm text-muted-foreground">
            Your payment adherence tracks how consistently you meet your debt payment goals based on your current extra payment settings.
          </p>
          <div className="bg-elevated rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Months Tracked:</span>
              <span className="text-foreground">{data.monthsTracked}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Average Adherence:</span>
              <span className="text-foreground">{data.overallAdherence}%</span>
            </div>
            {data.projectionAdjustment && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Projection Adjustment:</span>
                <span className={data.projectionAdjustment.monthsAheadOrBehind > 0 ? 'text-emerald-400' : 'text-red-400'}>
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
