'use client';

import { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, PartyPopper } from 'lucide-react';
import type { DebtPayoffSchedule } from '@/lib/debts/payoff-calculator';
import type { PieLabelRenderProps, PieChartDataPoint, RechartsTooltipPayloadItem } from '@/lib/types';

interface TotalCostPieChartProps {
  schedule: DebtPayoffSchedule;
  className?: string;
}

const COLORS = {
  principal: 'var(--color-chart-principal)',
  interest: 'var(--color-chart-interest)',
};

// Custom label renderer showing percentages
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx: cxProp = 0, cy: cyProp = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  const cx = typeof cxProp === 'string' ? parseFloat(cxProp) : cxProp;
  const cy = typeof cyProp === 'string' ? parseFloat(cyProp) : cyProp;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-base font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom tooltip props type
interface CostTooltipProps {
  active?: boolean;
  payload?: RechartsTooltipPayloadItem<PieChartDataPoint>[];
}

// Custom tooltip
const CustomTooltip = ({ active, payload }: CostTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg p-4 shadow-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
          {payload[0].name}
        </p>
        <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}% of total cost
        </p>
      </div>
    );
  }
  return null;
};

export function TotalCostPieChart({
  schedule,
  className = '',
}: TotalCostPieChartProps) {
  // Calculate total cost breakdown
  const costData = useMemo(() => {
    if (!schedule) {
      return null;
    }

    const principal = schedule.originalBalance;
    const interest = schedule.totalInterestPaid;
    const totalCost = principal + interest;
    const interestMultiplier = totalCost / principal;
    const principalPercent = (principal / totalCost) * 100;
    const interestPercent = (interest / totalCost) * 100;

    return {
      principal,
      interest,
      totalCost,
      interestMultiplier,
      principalPercent,
      interestPercent,
    };
  }, [schedule]);

  if (!schedule || !costData) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <p style={{ color: 'var(--color-muted-foreground)' }}>No cost data available</p>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Original Debt',
      value: parseFloat(costData.principal.toFixed(2)),
      total: costData.totalCost,
    },
    {
      name: 'Total Interest',
      value: parseFloat(costData.interest.toFixed(2)),
      total: costData.totalCost,
    },
  ];

  return (
    <div className={`rounded-xl p-6 ${className}`} style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
          Total Cost Breakdown
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          The true cost of this debt including all interest payments
        </p>
      </div>

      {/* Large Pie Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              isAnimationActive={true}
            >
              <Cell fill={COLORS.principal} />
              <Cell fill={COLORS.interest} />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Original Debt */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.principal }}
            />
            <span className="text-xs uppercase" style={{ color: 'var(--color-muted-foreground)' }}>Original Debt</span>
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${costData.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            {costData.principalPercent.toFixed(1)}% of total cost
          </div>
        </div>

        {/* Total Interest */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.interest }}
            />
            <span className="text-xs uppercase" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest</span>
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${costData.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            {costData.interestPercent.toFixed(1)}% of total cost
          </div>
        </div>
      </div>

      {/* Total Cost Banner */}
      <div className="rounded-lg p-4 mb-4" style={{ background: 'linear-gradient(to right, color-mix(in oklch, var(--color-accent) 20%, transparent), color-mix(in oklch, var(--color-accent) 10%, transparent))', border: '1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)' }}>
        <div className="text-center">
          <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Total Amount You&apos;ll Pay
          </div>
          <div className="text-3xl font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${costData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
            Over {schedule.monthsToPayoff} months ({(schedule.monthsToPayoff / 12).toFixed(1)} years)
          </div>
        </div>
      </div>

      {/* Cost Multiplier Alert */}
      {costData.interestMultiplier > 1.5 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--color-warning)' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-warning)' }}>
                High Interest Cost
              </p>
              <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                You&apos;ll pay <span className="font-bold">{costData.interestMultiplier.toFixed(2)}x</span> the original amount
                due to interest. Consider making extra payments to reduce this cost significantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Interest Success */}
      {costData.interestMultiplier <= 1.2 && costData.interest > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--color-success)' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-success)' }}>
                Great Interest Rate
              </p>
              <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                Your total cost is only <span className="font-bold">{costData.interestMultiplier.toFixed(2)}x</span> the original amount.
                This is a favorable rate!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zero Interest */}
      {costData.interest === 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
          <div className="flex items-start gap-3">
            <PartyPopper className="w-5 h-5 shrink-0" style={{ color: 'var(--color-success)' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-success)' }}>
                Interest-Free Debt
              </p>
              <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                This debt has no interest charges. You&apos;ll pay exactly what you borrowed!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
