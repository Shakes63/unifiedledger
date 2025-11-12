'use client';

import React from 'react';
import Decimal from 'decimal.js';

interface BudgetSummaryCardProps {
  summary: {
    totalIncome: number;
    totalIncomeActual: number;
    totalExpenseBudget: number;
    totalExpenseActual: number;
    totalSavingsBudget: number;
    totalSavingsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    adherenceScore: number;
    daysInMonth: number;
    daysRemaining: number;
    daysElapsed: number;
  };
  month: string;
}

export function BudgetSummaryCard({ summary, month }: BudgetSummaryCardProps) {
  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Calculate percentages for progress bars
  const incomePercentage =
    summary.totalIncome > 0
      ? new Decimal(summary.totalIncomeActual)
          .div(summary.totalIncome)
          .times(100)
          .toNumber()
      : 0;

  // Calculate income variance
  const incomeVariance = new Decimal(summary.totalIncomeActual)
    .minus(summary.totalIncome)
    .toNumber();

  // Determine income status (reversed from expenses)
  const incomeStatus =
    incomePercentage >= 100
      ? 'ahead' // Meeting or exceeding income target (green)
      : incomePercentage >= 80
      ? 'on_track' // Close to target (green)
      : incomePercentage >= 50
      ? 'warning' // Significant shortfall (amber)
      : 'critical'; // Severe shortfall (red)

  const expensePercentage =
    summary.totalExpenseBudget > 0
      ? new Decimal(summary.totalExpenseActual)
          .div(summary.totalExpenseBudget)
          .times(100)
          .toNumber()
      : 0;

  const savingsPercentage =
    summary.totalSavingsBudget > 0
      ? new Decimal(summary.totalSavingsActual)
          .div(summary.totalSavingsBudget)
          .times(100)
          .toNumber()
      : 0;

  // Determine expense status
  const expenseVariance = new Decimal(summary.totalExpenseBudget)
    .minus(summary.totalExpenseActual)
    .toNumber();

  const expenseStatus =
    expensePercentage >= 100
      ? 'exceeded'
      : expensePercentage >= 80
      ? 'warning'
      : 'on_track';

  // Determine savings status
  const savingsVariance = new Decimal(summary.totalSavingsActual)
    .minus(summary.totalSavingsBudget)
    .toNumber();

  const savingsStatus =
    savingsPercentage >= 100 ? 'ahead' : savingsPercentage >= 80 ? 'on_track' : 'behind';

  // Adherence score label
  const adherenceLabel =
    summary.adherenceScore >= 90
      ? 'Excellent'
      : summary.adherenceScore >= 70
      ? 'Good'
      : summary.adherenceScore >= 50
      ? 'Fair'
      : 'Needs Improvement';

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Monthly Summary - {formatMonth(month)}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Income */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Income</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                ${summary.totalIncome.toFixed(2)} budgeted
              </span>
              <span className="text-sm font-semibold text-[var(--color-income)]">
                ${summary.totalIncomeActual.toFixed(2)} actual
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                incomeStatus === 'ahead'
                  ? 'bg-[var(--color-success)]'
                  : incomeStatus === 'on_track'
                  ? 'bg-[var(--color-income)]'
                  : incomeStatus === 'warning'
                  ? 'bg-[var(--color-warning)]'
                  : 'bg-[var(--color-error)]'
              }`}
              style={{ width: `${Math.min(100, incomePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {incomePercentage.toFixed(1)}%
            </span>
            {incomeVariance > 0 ? (
              <span className="text-xs text-[var(--color-success)]">
                ✓ Exceeding expected by ${Math.abs(incomeVariance).toFixed(2)}
              </span>
            ) : incomeVariance < 0 ? (
              <span
                className={`text-xs ${
                  incomeStatus === 'critical'
                    ? 'text-[var(--color-error)]'
                    : 'text-[var(--color-warning)]'
                }`}
              >
                Below expected by ${Math.abs(incomeVariance).toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Meeting expected</span>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Expenses</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                ${summary.totalExpenseBudget.toFixed(2)} budgeted
              </span>
              <span className="text-sm font-semibold text-[var(--color-expense)]">
                ${summary.totalExpenseActual.toFixed(2)} actual
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                expenseStatus === 'exceeded'
                  ? 'bg-[var(--color-error)]'
                  : expenseStatus === 'warning'
                  ? 'bg-[var(--color-warning)]'
                  : 'bg-[var(--color-success)]'
              }`}
              style={{ width: `${Math.min(100, expensePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {expensePercentage.toFixed(1)}%
            </span>
            {expenseVariance > 0 ? (
              <span className="text-xs text-[var(--color-success)]">
                ✓ Under budget by ${Math.abs(expenseVariance).toFixed(2)}
              </span>
            ) : expenseVariance < 0 ? (
              <span className="text-xs text-[var(--color-error)]">
                Over budget by ${Math.abs(expenseVariance).toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">On budget</span>
            )}
          </div>
        </div>

        {/* Savings */}
        {summary.totalSavingsBudget > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Savings</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  ${summary.totalSavingsBudget.toFixed(2)} budgeted
                </span>
                <span className="text-sm font-semibold text-[var(--color-success)]">
                  ${summary.totalSavingsActual.toFixed(2)} actual
                </span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  savingsStatus === 'ahead'
                    ? 'bg-[var(--color-success)]'
                    : savingsStatus === 'on_track'
                    ? 'bg-[var(--color-income)]'
                    : 'bg-[var(--color-warning)]'
                }`}
                style={{ width: `${Math.min(100, savingsPercentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {savingsPercentage.toFixed(1)}%
              </span>
              {savingsVariance > 0 ? (
                <span className="text-xs text-[var(--color-success)]">
                  ✓ Ahead by ${Math.abs(savingsVariance).toFixed(2)}
                </span>
              ) : savingsVariance < 0 ? (
                <span className="text-xs text-[var(--color-warning)]">
                  Behind by ${Math.abs(savingsVariance).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">On target</span>
              )}
            </div>
          </div>
        )}

        {/* Budget Adherence & Days Remaining */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <span className="text-sm text-muted-foreground">Budget Adherence: </span>
            <span
              className={`text-sm font-semibold ${
                summary.adherenceScore >= 90
                  ? 'text-[var(--color-success)]'
                  : summary.adherenceScore >= 70
                  ? 'text-[var(--color-income)]'
                  : summary.adherenceScore >= 50
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-error)]'
              }`}
            >
              {summary.adherenceScore}% ({adherenceLabel})
            </span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">
              {summary.daysRemaining > 0
                ? `${summary.daysRemaining} ${
                    summary.daysRemaining === 1 ? 'day' : 'days'
                  } remaining`
                : 'Month complete'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
