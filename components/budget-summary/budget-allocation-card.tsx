'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Decimal from 'decimal.js';

interface CategoryDetail {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  percentage: number;
}

interface BudgetAllocationCardProps {
  title: string;
  icon: React.ReactNode;
  budgeted: number;
  actual: number;
  color: string;
  type: 'income' | 'expense' | 'savings' | 'debt';
  categories?: CategoryDetail[];
  defaultExpanded?: boolean;
}

export function BudgetAllocationCard({
  title,
  icon,
  budgeted,
  actual,
  color,
  type,
  categories = [],
  defaultExpanded = false,
}: BudgetAllocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate percentage
  const percentage = budgeted > 0 
    ? new Decimal(actual).div(budgeted).times(100).toNumber() 
    : 0;

  // Calculate variance
  const variance = new Decimal(actual).minus(budgeted).toNumber();

  // Determine status based on type
  const getStatus = (): 'on_track' | 'warning' | 'exceeded' => {
    if (type === 'income') {
      // For income: exceeding is good
      if (percentage >= 100) return 'on_track';
      if (percentage >= 80) return 'warning';
      return 'exceeded';
    } else if (type === 'savings') {
      // For savings: meeting or exceeding target is good
      if (percentage >= 80) return 'on_track';
      if (percentage >= 50) return 'warning';
      return 'exceeded';
    } else {
      // For expenses/debt: under budget is good
      if (percentage <= 80) return 'on_track';
      if (percentage <= 100) return 'warning';
      return 'exceeded';
    }
  };

  const status = getStatus();

  // Get status color for progress bar
  const getProgressColor = (): string => {
    if (type === 'income' || type === 'savings') {
      // Green when meeting target, warning when behind
      if (status === 'on_track') return 'var(--color-success)';
      if (status === 'warning') return 'var(--color-warning)';
      return 'var(--color-error)';
    } else {
      // For expenses: green when under, red when over
      if (status === 'on_track') return 'var(--color-success)';
      if (status === 'warning') return 'var(--color-warning)';
      return 'var(--color-error)';
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get variance text
  const getVarianceText = (): { text: string; isPositive: boolean } => {
    const absVariance = Math.abs(variance);
    
    if (type === 'income') {
      if (variance >= 0) {
        return { text: `+${formatCurrency(absVariance)} above target`, isPositive: true };
      }
      return { text: `${formatCurrency(absVariance)} below target`, isPositive: false };
    } else if (type === 'savings') {
      if (variance >= 0) {
        return { text: `+${formatCurrency(absVariance)} ahead`, isPositive: true };
      }
      return { text: `${formatCurrency(absVariance)} behind`, isPositive: false };
    } else {
      // Expenses - under budget is positive
      if (variance <= 0) {
        return { text: `${formatCurrency(absVariance)} under budget`, isPositive: true };
      }
      return { text: `${formatCurrency(absVariance)} over budget`, isPositive: false };
    }
  };

  const varianceInfo = getVarianceText();
  const hasCategories = categories.length > 0;

  return (
    <div 
      className="bg-card border border-border rounded-xl p-4 hover:bg-elevated/50 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color }} className="p-2 rounded-lg bg-elevated">
            {icon}
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        {hasCategories && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-elevated transition-colors text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? 'Collapse categories' : 'Expand categories'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Amounts */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span 
            className="text-2xl font-bold font-mono"
            style={{ color }}
          >
            {formatCurrency(actual)}
          </span>
          <span className="text-sm text-muted-foreground">
            / {formatCurrency(budgeted)}
          </span>
        </div>
        <p 
          className={`text-xs ${
            varianceInfo.isPositive 
              ? 'text-success' 
              : 'text-error'
          }`}
        >
          {varianceInfo.text}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{ 
              width: `${Math.min(100, percentage)}%`,
              backgroundColor: getProgressColor(),
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {percentage.toFixed(1)}%
          </span>
          {type === 'expense' && percentage > 100 && (
            <span className="text-xs text-error">
              {(percentage - 100).toFixed(1)}% over
            </span>
          )}
        </div>
      </div>

      {/* Expanded Categories */}
      {isExpanded && hasCategories && (
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate mr-2">
                {category.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-foreground">
                  {formatCurrency(category.actual)}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {formatCurrency(category.budgeted)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

