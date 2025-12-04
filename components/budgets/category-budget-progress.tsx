'use client';

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { AlertTriangle } from 'lucide-react';

interface CategoryBudgetProgressProps {
  category: {
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
  };
  daysRemaining: number;
  onEdit: (categoryId: string, newBudget: number) => void;
}

export function CategoryBudgetProgress({
  category,
  daysRemaining,
  onEdit,
}: CategoryBudgetProgressProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category.monthlyBudget.toString());

  const handleSave = () => {
    const newBudget = parseFloat(editValue);
    if (!isNaN(newBudget) && newBudget >= 0) {
      onEdit(category.id, newBudget);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(category.monthlyBudget.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Determine progress bar color (logic differs for income vs expenses)
  const getProgressColor = () => {
    const isIncome = category.type === 'income';

    if (category.status === 'exceeded') {
      // For income: exceeded = good (green), for expenses: exceeded = bad (red)
      return isIncome ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]';
    } else if (category.status === 'warning') {
      return 'bg-[var(--color-warning)]';
    } else if (category.status === 'on_track') {
      return 'bg-[var(--color-success)]';
    }
    return 'bg-muted';
  };

  // Check if pace is problematic (logic differs for income vs expenses)
  const isIncome = category.type === 'income';
  const isPaceTooHigh =
    daysRemaining > 0 &&
    category.budgetedDailyAverage > 0 &&
    (isIncome
      ? category.dailyAverage < category.budgetedDailyAverage * 0.8 // Income pace 20% below target
      : category.dailyAverage > category.budgetedDailyAverage * 1.2); // Expense pace 20% above target

  // Check if projected to exceed (meaning differs for income vs expenses)
  const isProjectedToExceed =
    category.monthlyBudget > 0 &&
    (isIncome
      ? category.projectedMonthEnd < category.monthlyBudget // Income shortfall
      : category.projectedMonthEnd > category.monthlyBudget); // Expense overage

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:bg-elevated transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-foreground">{category.name}</h3>
            {category.incomeFrequency && category.incomeFrequency !== 'variable' && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-income)]/20 text-[var(--color-income)] capitalize">
                {category.incomeFrequency === 'biweekly' ? 'Bi-weekly' : category.incomeFrequency}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {category.type.replace(/_/g, ' ')}
          </span>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-[var(--color-primary)] hover:opacity-80 transition-opacity"
          >
            Edit
          </button>
        )}
      </div>

      {/* Budget Amount */}
      <div className="mb-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
              min="0"
              step="0.01"
            />
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded-lg hover:opacity-90 transition-opacity"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 bg-muted text-foreground text-xs rounded-lg hover:bg-elevated transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              ${category.actualSpent.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">
              ${category.monthlyBudget.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {category.monthlyBudget > 0 && (
        <>
          <div className="w-full bg-muted rounded-lg h-2.5 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${Math.min(100, category.percentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span
              className={
                category.isOverBudget
                  ? category.type === 'income'
                    ? 'text-[var(--color-success)]' // Income over budget = good (green)
                    : 'text-[var(--color-error)]' // Expense over budget = bad (red)
                  : 'text-muted-foreground'
              }
            >
              {category.percentage.toFixed(1)}%
            </span>
            <span
              className={
                category.remaining === 0
                  ? 'text-[var(--color-success)]' // Exactly on target (green)
                  : category.type === 'income'
                  ? category.remaining > 0
                    ? 'text-[var(--color-warning)]' // Income shortfall
                    : 'text-[var(--color-success)]' // Extra income!
                  : category.remaining > 0
                  ? 'text-[var(--color-success)]' // Under budget
                  : 'text-[var(--color-error)]' // Over budget
              }
            >
              {category.remaining === 0
                ? 'Right on target'
                : category.type === 'income'
                ? category.remaining > 0
                  ? `$${category.remaining.toFixed(2)} below target`
                  : `$${Math.abs(category.remaining).toFixed(2)} above target`
                : category.remaining > 0
                ? `$${category.remaining.toFixed(2)} remaining`
                : `$${Math.abs(category.remaining).toFixed(2)} over`}
            </span>
          </div>
        </>
      )}

      {/* Empty State */}
      {category.monthlyBudget === 0 && (
        <div className="text-xs text-muted-foreground italic">No budget set</div>
      )}

      {/* Daily Spending & Projections */}
      {category.monthlyBudget > 0 &&
        daysRemaining > 0 &&
        category.shouldShowDailyAverage && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Daily average:</span>
            <span
              className={
                isPaceTooHigh ? 'text-[var(--color-warning)] flex items-center gap-1' : 'text-foreground'
              }
            >
              ${category.dailyAverage.toFixed(2)}
              {isPaceTooHigh && <AlertTriangle className="w-3 h-3" />}
            </span>
          </div>

          {isPaceTooHigh && (
            <div className="text-xs text-[var(--color-warning)]">
              {isIncome
                ? `Pace too low (target: $${category.budgetedDailyAverage.toFixed(2)}/day)`
                : `Pace too high (budget: $${category.budgetedDailyAverage.toFixed(2)}/day)`}
            </div>
          )}

          {isProjectedToExceed && (
            <div
              className={`text-xs ${
                isIncome ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
              }`}
            >
              {isIncome
                ? `Projected: $${category.projectedMonthEnd.toFixed(2)} (short by $${new Decimal(
                    category.monthlyBudget
                  )
                    .minus(category.projectedMonthEnd)
                    .toNumber()
                    .toFixed(2)})`
                : `Projected: $${category.projectedMonthEnd.toFixed(2)} (over by $${new Decimal(
                    category.projectedMonthEnd
                  )
                    .minus(category.monthlyBudget)
                    .toNumber()
                    .toFixed(2)})`}
            </div>
          )}

          {!isProjectedToExceed && category.projectedMonthEnd > 0 && (
            <div className="text-xs text-[var(--color-success)]">
              {isIncome
                ? `Projected: $${category.projectedMonthEnd.toFixed(2)} (above by $${new Decimal(
                    category.projectedMonthEnd
                  )
                    .minus(category.monthlyBudget)
                    .toNumber()
                    .toFixed(2)})`
                : `Projected: $${category.projectedMonthEnd.toFixed(2)} (under by $${new Decimal(
                    category.monthlyBudget
                  )
                    .minus(category.projectedMonthEnd)
                    .toNumber()
                    .toFixed(2)})`}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
          </div>
        </div>
      )}

      {/* Frequency-based Income Projection */}
      {category.monthlyBudget > 0 &&
        daysRemaining > 0 &&
        category.type === 'income' &&
        !category.shouldShowDailyAverage &&
        category.incomeFrequency && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="text-xs text-muted-foreground">
            Expected this month: ${category.monthlyBudget.toFixed(2)}
          </div>
          {category.actualSpent < category.monthlyBudget && (
            <div className="text-xs text-muted-foreground">
              Waiting for {category.incomeFrequency} payment
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
          </div>
        </div>
      )}
    </div>
  );
}
