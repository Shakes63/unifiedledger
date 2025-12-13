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
      <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">
          {payload[0].name}
        </p>
        <p className="text-lg font-bold text-foreground font-mono">
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
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
        <p className="text-muted-foreground">No cost data available</p>
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
    <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Total Cost Breakdown
        </h3>
        <p className="text-sm text-muted-foreground">
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
        <div className="bg-elevated rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.principal }}
            />
            <span className="text-xs text-muted-foreground uppercase">Original Debt</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            ${costData.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {costData.principalPercent.toFixed(1)}% of total cost
          </div>
        </div>

        {/* Total Interest */}
        <div className="bg-elevated rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.interest }}
            />
            <span className="text-xs text-muted-foreground uppercase">Total Interest</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            ${costData.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {costData.interestPercent.toFixed(1)}% of total cost
          </div>
        </div>
      </div>

      {/* Total Cost Banner */}
      <div className="bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase mb-1">
            Total Amount You&apos;ll Pay
          </div>
          <div className="text-3xl font-bold text-foreground font-mono">
            ${costData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Over {schedule.monthsToPayoff} months ({(schedule.monthsToPayoff / 12).toFixed(1)} years)
          </div>
        </div>
      </div>

      {/* Cost Multiplier Alert */}
      {costData.interestMultiplier > 1.5 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning mb-1">
                High Interest Cost
              </p>
              <p className="text-sm text-foreground">
                You&apos;ll pay <span className="font-bold">{costData.interestMultiplier.toFixed(2)}x</span> the original amount
                due to interest. Consider making extra payments to reduce this cost significantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Interest Success */}
      {costData.interestMultiplier <= 1.2 && costData.interest > 0 && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-success mb-1">
                Great Interest Rate
              </p>
              <p className="text-sm text-foreground">
                Your total cost is only <span className="font-bold">{costData.interestMultiplier.toFixed(2)}x</span> the original amount.
                This is a favorable rate!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zero Interest */}
      {costData.interest === 0 && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <PartyPopper className="w-5 h-5 text-success flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-success mb-1">
                Interest-Free Debt
              </p>
              <p className="text-sm text-foreground">
                This debt has no interest charges. You&apos;ll pay exactly what you borrowed!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
