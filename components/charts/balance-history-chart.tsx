'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { parseISO } from 'date-fns';

const DEFAULT_ACCOUNT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

interface AccountInfo {
  id: string;
  name: string;
  color: string;
}

interface BalanceHistoryChartProps {
  className?: string;
}

// Custom tooltip component
function CustomTooltip({ 
  active, 
  payload, 
  label,
  accounts: _accounts,
}: { 
  active?: boolean; 
  payload?: { dataKey: string; value: number; color: string }[]; 
  label?: string;
  accounts: AccountInfo[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Find total
  const totalEntry = payload.find(p => p.dataKey === 'total');
  const total = totalEntry?.value || 0;

  return (
    <div className="rounded-lg p-3 shadow-lg min-w-[200px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
      <p className="text-sm mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
        {label ? parseISO(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
      </p>
      
      <div className="space-y-1 mb-2">
        {payload
          .filter(p => p.dataKey !== 'total' && p.dataKey !== 'date')
          .map((entry) => (
            <div key={entry.dataKey} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }} 
                />
                <span style={{ color: 'var(--color-muted-foreground)' }}>{entry.dataKey}</span>
              </div>
              <span className="font-mono font-medium" style={{ color: 'var(--color-foreground)' }}>
                ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
      </div>
      
      <div className="pt-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Total</span>
        <span className="font-mono font-bold" style={{ color: 'var(--color-destructive)' }}>
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export function BalanceHistoryChart({ className = '' }: BalanceHistoryChartProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<{ date: string; total: number; [key: string]: string | number }[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [viewMode, setViewMode] = useState<'stacked' | 'individual'>('stacked');

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithHousehold(`/api/accounts/balance-history?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to load balance history');
      }

      const result = await response.json();
      setData(result.aggregated || []);
      setAccounts(result.accounts || []);
    } catch (err) {
      console.error('Error loading balance history:', err);
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

  // Format currency for y-axis
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value}`;
  };

  const accountColors = useMemo(() => {
    return accounts.map((acc, index) => ({
      ...acc,
      color: acc.color || DEFAULT_ACCOUNT_COLORS[index % DEFAULT_ACCOUNT_COLORS.length],
    }));
  }, [accounts]);

  return (
    <ChartContainer
      title="Credit Balance History"
      description="Track how your credit card balances change over time"
      isLoading={loading}
      error={error}
      className={className}
    >
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {[
            { value: 30, label: '30 Days' },
            { value: 60, label: '60 Days' },
            { value: 90, label: '90 Days' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: days === value ? 'var(--color-primary)' : 'var(--color-elevated)',
                color: days === value ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                border: days === value ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        {accounts.length > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('stacked')}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: viewMode === 'stacked' ? 'var(--color-primary)' : 'var(--color-elevated)',
                color: viewMode === 'stacked' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                border: viewMode === 'stacked' ? 'none' : '1px solid var(--color-border)',
              }}
            >
              Stacked
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: viewMode === 'individual' ? 'var(--color-primary)' : 'var(--color-elevated)',
                color: viewMode === 'individual' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                border: viewMode === 'individual' ? 'none' : '1px solid var(--color-border)',
              }}
            >
              Individual
            </button>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64" style={{ color: 'var(--color-muted-foreground)' }}>
          <p>No balance history available. Check back after recording some credit activity.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {accountColors.map((acc) => (
                <linearGradient key={acc.id} id={`gradient-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={acc.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={acc.color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <YAxis 
              tickFormatter={formatCurrency}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <Tooltip content={<CustomTooltip accounts={accounts} />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            
            {accountColors.map((acc) => (
              <Area
                key={acc.id}
                type="monotone"
                dataKey={acc.name}
                stackId={viewMode === 'stacked' ? '1' : undefined}
                stroke={acc.color}
                strokeWidth={2}
                fill={`url(#gradient-${acc.id})`}
                isAnimationActive={true}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Account Legend with Current Balances */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {accountColors.map((acc) => {
            const latestData = data[data.length - 1];
            const balance = latestData ? (latestData[acc.name] as number || 0) : 0;
            
            return (
              <div key={acc.id} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: acc.color }} 
                />
                <span className="truncate" style={{ color: 'var(--color-muted-foreground)' }}>{acc.name}</span>
                <span className="font-mono ml-auto" style={{ color: 'var(--color-foreground)' }}>
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ChartContainer>
  );
}
