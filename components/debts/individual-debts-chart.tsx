'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Legend payload type from Recharts
interface LegendPayload {
  dataKey?: string | number | ((obj: Record<string, unknown>) => unknown);
  value?: string | number;
  color?: string;
}

interface ChartDataPoint {
  month: string;
  byDebt: Record<string, number>;
}

interface DebtDetail {
  id: string;
  name: string;
  color: string;
}

interface IndividualDebtsChartProps {
  data: ChartDataPoint[];
  debtDetails: DebtDetail[];
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  color?: string;
  name?: string;
  payload?: Record<string, unknown>;
}

function CustomTooltip({
  active,
  payload,
  debtMap,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  debtMap?: Record<string, DebtDetail>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload as { month?: string } | undefined;
  if (!data) return null;

  // Sort payload by value (descending) for better readability
  const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

  return (
    <div
      className="p-3 rounded-lg border"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
    >
      <p className="font-semibold text-foreground text-sm mb-2">
        {data.month}
      </p>
      {sortedPayload.map((entry: TooltipPayloadItem, index: number) => {
        const debtId = entry.dataKey;
        const debtName = debtMap?.[debtId]?.name || debtId;
        return (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {debtName}: {formatCurrency(entry.value)}
          </p>
        );
      })}
    </div>
  );
}

export function IndividualDebtsChart({
  data,
  debtDetails,
  isLoading,
}: IndividualDebtsChartProps) {
  const [visibleDebts, setVisibleDebts] = useState<Set<string>>(
    new Set(debtDetails.map(d => d.id))
  );

  // Sort data by month to ensure proper rendering
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  // Create debt map for tooltip
  const debtMap = useMemo(() => {
    return debtDetails.reduce(
      (map, debt) => {
        map[debt.id] = debt;
        return map;
      },
      {} as Record<string, DebtDetail>
    );
  }, [debtDetails]);

  const handleLegendClick = (e: LegendPayload) => {
    const debtId = typeof e.dataKey === 'string' ? e.dataKey : String(e.dataKey || '');
    const newVisible = new Set(visibleDebts);
    if (newVisible.has(debtId)) {
      newVisible.delete(debtId);
    } else {
      newVisible.add(debtId);
    }
    setVisibleDebts(newVisible);
  };

  if (isLoading) {
    return (
      <div
        className="w-full h-96 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground">Loading chart...</p>
      </div>
    );
  }

  if (sortedData.length === 0 || debtDetails.length === 0) {
    return (
      <div
        className="w-full h-96 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground">No debt data available</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg p-4" style={{ backgroundColor: 'var(--color-card)' }}>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={sortedData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <defs>
            {debtDetails.map(debt => (
              <linearGradient
                key={`gradient-${debt.id}`}
                id={`gradient-${debt.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={debt.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={debt.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />

          <YAxis
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />

          <Tooltip
            content={<CustomTooltip debtMap={debtMap} />}
          />

          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            onClick={handleLegendClick}
            formatter={(value) => {
              const debtDetail = debtMap[value];
              return (
                <span style={{ color: 'var(--color-foreground)' }}>
                  {debtDetail?.name || value}
                </span>
              );
            }}
          />

          {/* Render stacked areas for each debt */}
          {debtDetails.map((debt, _index) => (
            <Area
              key={debt.id}
              type="monotone"
              dataKey={debt.id}
              stackId="debts"
              stroke={debt.color}
              fill={`url(#gradient-${debt.id})`}
              isAnimationActive={true}
              dot={false}
              hide={!visibleDebts.has(debt.id)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary by debt */}
      <div className="mt-4">
        <p className="text-xs text-muted-foreground mb-2">Current Balances</p>
        <div className="grid grid-cols-2 gap-2">
          {debtDetails.map(debt => {
            const latestBalance =
              sortedData[sortedData.length - 1]?.byDebt[debt.id] || 0;
            return (
              <div
                key={debt.id}
                className="p-2 rounded text-sm"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  borderLeft: `3px solid ${debt.color}`,
                }}
              >
                <p className="text-muted-foreground text-xs truncate">
                  {debt.name}
                </p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(latestBalance)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
