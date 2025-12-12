'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CategoryBudgetProgress } from './category-budget-progress';
import Decimal from 'decimal.js';

interface CategoryData {
  id: string;
  name: string;
  type: string;
  monthlyBudget: number;
  actualSpent: number;
  remaining: number;
  percentage: number;
  status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted';
  dailyAverage: number;
  budgetedDailyAverage: number;
  projectedMonthEnd: number;
  isOverBudget: boolean;
  incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable';
  shouldShowDailyAverage: boolean;
  rolloverEnabled?: boolean;
  rolloverBalance?: number;
  rolloverLimit?: number | null;
  effectiveBudget?: number;
  parentId?: string | null;
}

interface BudgetGroup {
  id: string;
  name: string;
  type: string;
  targetAllocation: number | null;
  totalBudget: number;
  totalSpent: number;
}

interface BudgetGroupSectionProps {
  group: BudgetGroup;
  categories: CategoryData[];
  monthlyIncome?: number;
  daysRemaining: number;
  onEditBudget: (categoryId: string, newBudget: number) => void;
  defaultExpanded?: boolean;
}

export function BudgetGroupSection({
  group,
  categories,
  monthlyIncome = 0,
  daysRemaining,
  onEditBudget,
  defaultExpanded = true,
}: BudgetGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate aggregate metrics
  const totalBudget = categories.reduce(
    (sum, cat) => new Decimal(sum).plus(cat.monthlyBudget || 0).toNumber(),
    0
  );
  const totalSpent = categories.reduce(
    (sum, cat) => new Decimal(sum).plus(cat.actualSpent || 0).toNumber(),
    0
  );
  const remaining = new Decimal(totalBudget).minus(totalSpent).toNumber();
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Calculate target amount if we have monthly income and target allocation
  const targetAmount = group.targetAllocation && monthlyIncome > 0
    ? new Decimal(monthlyIncome).times(group.targetAllocation / 100).toNumber()
    : null;

  // Determine group status based on aggregate
  const getGroupStatus = (): 'on_track' | 'warning' | 'exceeded' | 'unbudgeted' => {
    if (totalBudget === 0) return 'unbudgeted';
    if (percentage > 100) return 'exceeded';
    if (percentage >= 80) return 'warning';
    return 'on_track';
  };

  const status = getGroupStatus();

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'exceeded':
        return 'var(--color-error)';
      case 'warning':
        return 'var(--color-warning)';
      case 'on_track':
        return 'var(--color-success)';
      default:
        return 'var(--color-muted-foreground)';
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Group Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{group.name}</h3>
              {group.targetAllocation && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-elevated text-muted-foreground">
                  {group.targetAllocation}% target
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </div>
          </div>
        </div>

        {/* Aggregate Progress */}
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: getStatusColor() }}>
              {formatCurrency(totalSpent)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatCurrency(totalBudget)}
            </span>
          </div>
          {targetAmount !== null && totalBudget !== targetAmount && (
            <div className="text-xs text-muted-foreground">
              Target: {formatCurrency(targetAmount)}
            </div>
          )}
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: getStatusColor(),
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{percentage.toFixed(0)}% used</span>
          <span>
            {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
          </span>
        </div>
      </div>

      {/* Expanded Categories */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => (
              <CategoryBudgetProgress
                key={category.id}
                category={category}
                daysRemaining={daysRemaining}
                onEdit={onEditBudget}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
