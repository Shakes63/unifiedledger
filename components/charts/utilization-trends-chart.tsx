'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { parseISO } from 'date-fns';

interface UtilizationDataPoint {
  date: string;
  utilization: number;
  balance: number;
  creditLimit: number;
}

interface UtilizationTrendsChartProps {
  className?: string;
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: UtilizationDataPoint }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const utilizationColor = data.utilization >= 80 
    ? 'var(--color-error)' 
    : data.utilization >= 30 
    ? 'var(--color-warning)' 
    : 'var(--color-success)';

  return (
    <div className="bg-elevated border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm text-muted-foreground mb-2">
        {label ? parseISO(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
      </p>
      <div className="space-y-1">
        <p className="text-lg font-bold" style={{ color: utilizationColor }}>
          {data.utilization.toFixed(1)}% utilization
        </p>
        <p className="text-sm text-muted-foreground">
          Balance: ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-muted-foreground">
          Limit: ${data.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

export function UtilizationTrendsChart({ className = '' }: UtilizationTrendsChartProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<UtilizationDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithHousehold(`/api/accounts/utilization-history?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to load utilization history');
      }

      const result = await response.json();
      setData(result.aggregated || []);
    } catch (err) {
      console.error('Error loading utilization history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, days, fetchWithHousehold]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format date for x-axis
  const formatDate = (dateStr: string) => {
    return parseISO(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Determine chart gradient based on current utilization
  const currentUtilization = data.length > 0 ? data[data.length - 1].utilization : 0;
  const gradientColor = currentUtilization >= 80 
    ? 'var(--color-error)' 
    : currentUtilization >= 30 
    ? 'var(--color-warning)' 
    : 'var(--color-success)';

  return (
    <ChartContainer
      title="Credit Utilization Trends"
      description="Track how your credit utilization changes over time"
      isLoading={loading}
      error={error}
      className={className}
    >
      {/* Time Range Selector */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 30, label: '30 Days' },
          { value: 60, label: '60 Days' },
          { value: 90, label: '90 Days' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setDays(value)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              days === value
                ? 'bg-(--color-primary) text-(--color-primary-foreground)'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>No utilization history available. Check back after recording some credit activity.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.8} />
                <stop offset="95%" stopColor={gradientColor} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <YAxis 
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference zones for utilization levels */}
            <ReferenceArea y1={0} y2={30} fill="var(--color-success)" fillOpacity={0.05} />
            <ReferenceArea y1={30} y2={80} fill="var(--color-warning)" fillOpacity={0.05} />
            <ReferenceArea y1={80} y2={100} fill="var(--color-error)" fillOpacity={0.05} />
            
            {/* Reference lines for key thresholds */}
            <ReferenceLine 
              y={30} 
              stroke="var(--color-success)" 
              strokeDasharray="3 3"
              label={{ value: 'Good (30%)', position: 'right', fill: 'var(--color-success)', fontSize: 10 }}
            />
            <ReferenceLine 
              y={80} 
              stroke="var(--color-error)" 
              strokeDasharray="3 3"
              label={{ value: 'High (80%)', position: 'right', fill: 'var(--color-error)', fontSize: 10 }}
            />
            
            <Area
              type="monotone"
              dataKey="utilization"
              stroke={gradientColor}
              strokeWidth={2}
              fill="url(#utilizationGradient)"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-success)' }} />
          <span className="text-muted-foreground">0-30% Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-warning)' }} />
          <span className="text-muted-foreground">30-80% Fair</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-error)' }} />
          <span className="text-muted-foreground">80%+ High</span>
        </div>
      </div>
    </ChartContainer>
  );
}
