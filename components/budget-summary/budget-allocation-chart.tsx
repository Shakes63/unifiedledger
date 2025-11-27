'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Decimal from 'decimal.js';

interface AllocationChartData {
  variableExpenses: number;
  monthlyBills: number;
  nonMonthlyBills: number;
  savings: number;
  debtPayments: number;
  surplus: number;
  totalIncome: number;
}

interface BudgetAllocationChartProps {
  data: AllocationChartData;
  showActual?: boolean; // Toggle between budgeted and actual view
}

export function BudgetAllocationChart({ 
  data,
  showActual = false,
}: BudgetAllocationChartProps) {
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Build chart data - only include segments with positive values
  const chartData = [
    { 
      name: 'Variable Expenses', 
      value: Math.max(0, data.variableExpenses), 
      color: 'var(--color-expense)',
      colorValue: '#ef4444', // Fallback for Recharts
    },
    { 
      name: 'Monthly Bills', 
      value: Math.max(0, data.monthlyBills), 
      color: 'var(--color-transfer)',
      colorValue: '#3b82f6',
    },
    { 
      name: 'Non-Monthly Bills', 
      value: Math.max(0, data.nonMonthlyBills), 
      color: 'var(--color-warning)',
      colorValue: '#f59e0b',
    },
    { 
      name: 'Savings', 
      value: Math.max(0, data.savings), 
      color: 'var(--color-success)',
      colorValue: '#22c55e',
    },
    { 
      name: 'Debt Payments', 
      value: Math.max(0, data.debtPayments), 
      color: 'var(--color-error)',
      colorValue: '#dc2626',
    },
    { 
      name: 'Surplus', 
      value: Math.max(0, data.surplus), 
      color: 'var(--color-income)',
      colorValue: '#10b981',
    },
  ].filter(item => item.value > 0);

  // Calculate total for percentage
  const total = chartData.reduce((sum, item) => 
    new Decimal(sum).plus(item.value).toNumber(), 0
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 
        ? new Decimal(item.value).div(total).times(100).toNumber() 
        : 0;
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="text-sm font-mono" style={{ color: item.color }}>
            {formatCurrency(item.value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // If no data, show empty state
  if (chartData.length === 0 || total === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4">Budget Allocation</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground">No budget data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Set up your budget to see allocation breakdown
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-semibold text-foreground mb-4">
        Budget Allocation {showActual ? '(Actual)' : '(Budgeted)'}
      </h3>
      
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.colorValue}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ transform: 'translateY(-20px)' }}>
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {formatCurrency(data.totalIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="font-mono font-semibold text-[var(--color-expense)]">
            {formatCurrency(
              new Decimal(data.variableExpenses)
                .plus(data.monthlyBills)
                .plus(data.nonMonthlyBills)
                .toNumber()
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="font-mono font-semibold text-[var(--color-success)]">
            {formatCurrency(data.surplus)}
          </p>
        </div>
      </div>
    </div>
  );
}

