'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

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

interface AccountSummary {
  accountId: string;
  accountName: string;
  accountColor: string;
  interestPaid: number;
  interestRate: number | null;
  transactionCount: number;
}

interface MonthlyData {
  month: string;
  total: number;
  byAccount: Record<string, number>;
}

interface InterestPaidData {
  summary: {
    totalInterestPaid: number;
    ytdInterestPaid: number;
    averageMonthly: number;
  };
  byAccount: AccountSummary[];
  monthly: MonthlyData[];
}

interface InterestPaidChartProps {
  className?: string;
}

// Custom tooltip for monthly chart
function MonthlyTooltip({ 
  active, 
  payload, 
  label,
  accounts: _accounts,
}: { 
  active?: boolean; 
  payload?: { dataKey: string; value: number; color: string }[]; 
  label?: string;
  accounts: AccountSummary[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Parse month for display
  const [year, month] = (label || '').split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Find total
  const totalEntry = payload.find(p => p.dataKey === 'total');
  const total = totalEntry?.value || 0;

  return (
    <div className="bg-elevated border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
      <p className="text-sm text-muted-foreground mb-2">{monthName}</p>
      
      <div className="space-y-1 mb-2">
        {payload
          .filter(p => p.dataKey !== 'total' && p.dataKey !== 'month')
          .map((entry) => (
            <div key={entry.dataKey} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }} 
                />
                <span className="text-muted-foreground">{entry.dataKey}</span>
              </div>
              <span className="font-mono font-medium text-foreground">
                ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
      </div>
      
      <div className="pt-2 border-t border-border flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">Total</span>
        <span className="font-mono font-bold text-(--color-error)">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export function InterestPaidChart({ className = '' }: InterestPaidChartProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<InterestPaidData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(365);
  const [viewMode, setViewMode] = useState<'monthly' | 'byAccount'>('monthly');

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithHousehold(`/api/accounts/interest-paid?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to load interest data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading interest data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, days, fetchWithHousehold]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format month for x-axis
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
      month: 'short',
      year: days > 365 ? '2-digit' : undefined,
    });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  const accountColors = useMemo(() => {
    if (!data?.byAccount) return {};
    const colors: Record<string, string> = {};
    data.byAccount.forEach((acc, index) => {
      colors[acc.accountName] =
        acc.accountColor || DEFAULT_ACCOUNT_COLORS[index % DEFAULT_ACCOUNT_COLORS.length];
    });
    return colors;
  }, [data?.byAccount]);

  // Prepare chart data for monthly view
  const monthlyChartData = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map(m => ({
      month: m.month,
      total: m.total,
      ...m.byAccount,
    }));
  }, [data?.monthly]);

  // Get unique account names for stacked bars
  const accountNames = useMemo(() => {
    if (!data?.byAccount) return [];
    return data.byAccount.map(a => a.accountName);
  }, [data?.byAccount]);

  const hasData = data && data.byAccount.length > 0;

  return (
    <ChartContainer
      title="Interest Paid"
      description="Track interest charges across your credit accounts"
      isLoading={loading}
      error={error}
      className={className}
    >
      {/* Summary Stats */}
      {hasData && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-elevated rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Total ({days} days)</p>
            <p className="text-lg font-bold font-mono text-(--color-error)">
              ${data.summary.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-elevated rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Year-to-Date</p>
            <p className="text-lg font-bold font-mono text-(--color-error)">
              ${data.summary.ytdInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-elevated rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Avg Monthly</p>
            <p className="text-lg font-bold font-mono text-(--color-warning)">
              ${data.summary.averageMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {[
            { value: 180, label: '6 Months' },
            { value: 365, label: '1 Year' },
            { value: 730, label: '2 Years' },
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

        {/* View Mode Toggle */}
        {hasData && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-(--color-primary) text-(--color-primary-foreground)'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('byAccount')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'byAccount'
                  ? 'bg-(--color-primary) text-(--color-primary-foreground)'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              By Account
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>No interest charges found. This is a good thing!</p>
        </div>
      ) : viewMode === 'monthly' ? (
        // Monthly stacked bar chart
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <YAxis 
              tickFormatter={formatCurrency}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <Tooltip content={<MonthlyTooltip accounts={data.byAccount} />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            
            {accountNames.map((name) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="interest"
                fill={accountColors[name]}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        // By Account horizontal bar chart
        <ResponsiveContainer width="100%" height={Math.max(200, data.byAccount.length * 50)}>
          <BarChart 
            data={data.byAccount} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            
            <XAxis 
              type="number"
              tickFormatter={formatCurrency}
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
            />
            
            <YAxis 
              type="category"
              dataKey="accountName"
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
              width={90}
            />
            
            <Tooltip 
              formatter={(value: number) => [
                `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                'Interest Paid'
              ]}
              labelFormatter={(label) => label}
              contentStyle={{
                backgroundColor: 'var(--color-elevated)',
                borderColor: 'var(--color-border)',
                borderRadius: '8px',
              }}
            />
            
            <Bar dataKey="interestPaid" radius={[0, 4, 4, 0]}>
              {data.byAccount.map((entry) => (
                <Cell key={entry.accountId} fill={entry.accountColor || '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Account Details Table */}
      {hasData && data.byAccount.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">Account Breakdown</h4>
          <div className="space-y-2">
            {data.byAccount.map((acc) => (
              <div 
                key={acc.accountId} 
                className="flex items-center justify-between p-2 rounded-lg bg-elevated"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: acc.accountColor }} 
                  />
                  <span className="text-sm text-foreground">{acc.accountName}</span>
                  {acc.interestRate && (
                    <span className="text-xs text-muted-foreground">
                      ({acc.interestRate.toFixed(2)}% APR)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-(--color-error)">
                    ${acc.interestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({acc.transactionCount} charge{acc.transactionCount !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartContainer>
  );
}

