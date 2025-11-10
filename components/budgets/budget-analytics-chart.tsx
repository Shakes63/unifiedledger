'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BudgetAnalyticsChartProps {
  data: Array<{
    month: string;
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRate: number;
  }>;
  height?: number;
}

/**
 * Custom tooltip for budget analytics
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  // Format month (YYYY-MM to MMM YYYY)
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const incomeData = payload.find((p: any) => p.dataKey === 'totalIncome');
  const expensesData = payload.find((p: any) => p.dataKey === 'totalExpenses');
  const savingsData = payload.find((p: any) => p.dataKey === 'savings');

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground mb-2">{formatMonth(label)}</p>
      <div className="space-y-1">
        {incomeData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: incomeData.color as string }}
              />
              {incomeData.name}:
            </span>
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(incomeData.value as number)}
            </span>
          </div>
        )}
        {expensesData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: expensesData.color as string }}
              />
              {expensesData.name}:
            </span>
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(expensesData.value as number)}
            </span>
          </div>
        )}
        {savingsData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: savingsData.color as string }}
              />
              {savingsData.name}:
            </span>
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(savingsData.value as number)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Budget analytics chart showing income, expenses, and savings over time
 */
export function BudgetAnalyticsChart({ data, height = 350 }: BudgetAnalyticsChartProps) {
  // Format month for X-axis
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);

    // If more than 6 months, use abbreviated format
    if (data.length > 6) {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format currency for Y-axis
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  // Get CSS variable values for colors
  const getColor = (variable: string) => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      return value || '#666'; // Fallback
    }
    return '#666';
  };

  const incomeColor = getColor('--color-success');
  const expenseColor = getColor('--color-error');
  const savingsColor = getColor('--color-primary');
  const gridColor = getColor('--color-border');
  const textColor = getColor('--color-muted-foreground');

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-card border border-border rounded-xl">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="month"
            stroke={textColor}
            style={{ fontSize: '12px' }}
            tickFormatter={formatMonth}
            angle={data.length > 6 ? -45 : 0}
            textAnchor={data.length > 6 ? 'end' : 'middle'}
            height={data.length > 6 ? 60 : 30}
          />
          <YAxis
            stroke={textColor}
            style={{ fontSize: '12px' }}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="totalIncome"
            stroke={incomeColor}
            name="Income"
            strokeWidth={2}
            dot={{ fill: incomeColor, r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="totalExpenses"
            stroke={expenseColor}
            name="Expenses"
            strokeWidth={2}
            dot={{ fill: expenseColor, r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="savings"
            stroke={savingsColor}
            name="Savings"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: savingsColor, r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
