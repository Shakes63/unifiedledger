'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import Decimal from 'decimal.js';
import Link from 'next/link';

interface MonthlySurplusCardProps {
  budgetedSurplus: number;
  actualSurplus: number;
  totalIncome: number;
}

export function MonthlySurplusCard({
  budgetedSurplus,
  actualSurplus,
  totalIncome,
}: MonthlySurplusCardProps) {
  // Calculate variance between budgeted and actual
  const variance = new Decimal(actualSurplus).minus(budgetedSurplus).toNumber();
  
  // Calculate surplus as percentage of income
  const actualPercentage = totalIncome > 0 
    ? new Decimal(actualSurplus).div(totalIncome).times(100).toNumber() 
    : 0;
  
  const budgetedPercentage = totalIncome > 0 
    ? new Decimal(budgetedSurplus).div(totalIncome).times(100).toNumber() 
    : 0;

  // Determine status
  const isSurplus = actualSurplus >= 0;
  const _isOnTrack = actualSurplus >= budgetedSurplus;

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  // Get icon based on status
  const StatusIcon = isSurplus 
    ? TrendingUp 
    : actualSurplus === 0 
      ? Minus 
      : TrendingDown;

  // Get colors based on status
  const primaryColor = isSurplus 
    ? 'var(--color-success)' 
    : 'var(--color-error)';

  const statusLabel = isSurplus ? 'Surplus' : 'Shortfall';

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Monthly {statusLabel}</h3>
        <div 
          className="p-2 rounded-lg"
          style={{ 
            backgroundColor: `color-mix(in oklch, ${primaryColor} 15%, transparent)`,
          }}
        >
          <StatusIcon 
            className="w-5 h-5" 
            style={{ color: primaryColor }}
          />
        </div>
      </div>

      {/* Main Amount */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          {!isSurplus && (
            <span 
              className="text-lg font-bold"
              style={{ color: primaryColor }}
            >
              -
            </span>
          )}
          <span 
            className="text-3xl font-bold font-mono"
            style={{ color: primaryColor }}
          >
            {formatCurrency(actualSurplus)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {actualPercentage.toFixed(1)}% of income remaining
        </p>
      </div>

      {/* Budgeted vs Actual Comparison */}
      <div className="p-3 bg-elevated rounded-lg mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Budgeted</p>
            <p className="font-mono font-semibold text-foreground">
              {budgetedSurplus >= 0 ? '' : '-'}{formatCurrency(budgetedSurplus)}
            </p>
            <p className="text-xs text-muted-foreground">
              ({budgetedPercentage.toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Actual</p>
            <p 
              className="font-mono font-semibold"
              style={{ color: primaryColor }}
            >
              {actualSurplus >= 0 ? '' : '-'}{formatCurrency(actualSurplus)}
            </p>
            <p className="text-xs text-muted-foreground">
              ({actualPercentage.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Variance */}
      <div className="flex items-center justify-between p-3 bg-elevated rounded-lg mb-4">
        <span className="text-sm text-muted-foreground">Variance</span>
        <span 
          className={`font-mono font-semibold ${
            variance >= 0 
              ? 'text-[var(--color-success)]' 
              : 'text-[var(--color-error)]'
          }`}
        >
          {variance >= 0 ? '+' : '-'}{formatCurrency(variance)}
        </span>
      </div>

      {/* Quick Actions */}
      {isSurplus && actualSurplus > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            Put your surplus to work:
          </p>
          <div className="flex flex-wrap gap-2">
            <Link 
              href="/dashboard/debts"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
            >
              Apply to Debt
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link 
              href="/dashboard/goals"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors"
            >
              Add to Savings
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Shortfall Warning */}
      {!isSurplus && (
        <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <p className="text-xs text-[var(--color-error)]">
            You're spending more than you're earning this month. 
            Review your expenses or adjust your budget.
          </p>
          <Link 
            href="/dashboard/budgets"
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-error)] hover:underline"
          >
            Review Budget
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

