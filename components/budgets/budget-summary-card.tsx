'use client';

import React from 'react';
import Decimal from 'decimal.js';
import { CreditCard } from 'lucide-react';

export interface DebtBudgetData {
  totalRecommendedPayments: number;
  totalActualPaid: number;
  debts: { debtId: string }[];
}

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
  debtData?: DebtBudgetData | null;
}

export function BudgetSummaryCard({ summary, month, debtData }: BudgetSummaryCardProps) {

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
              <span className="text-sm font-semibold text-income">
                ${summary.totalIncomeActual.toFixed(2)} actual
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                incomeStatus === 'ahead'
                  ? 'bg-success'
                  : incomeStatus === 'on_track'
                  ? 'bg-income'
                  : incomeStatus === 'warning'
                  ? 'bg-warning'
                  : 'bg-error'
              }`}
              style={{ width: `${Math.min(100, incomePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {incomePercentage.toFixed(1)}%
            </span>
            {incomeVariance > 0 ? (
              <span className="text-xs text-success">
                ✓ Exceeding expected by ${Math.abs(incomeVariance).toFixed(2)}
              </span>
            ) : incomeVariance < 0 ? (
              <span
                className={`text-xs ${
                  incomeStatus === 'critical'
                    ? 'text-error'
                    : 'text-warning'
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
              <span className="text-sm font-semibold text-expense">
                ${summary.totalExpenseActual.toFixed(2)} actual
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                expenseStatus === 'exceeded'
                  ? 'bg-error'
                  : expenseStatus === 'warning'
                  ? 'bg-warning'
                  : 'bg-success'
              }`}
              style={{ width: `${Math.min(100, expensePercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {expensePercentage.toFixed(1)}%
            </span>
            {expenseVariance > 0 ? (
              <span className="text-xs text-success">
                ✓ Under budget by ${Math.abs(expenseVariance).toFixed(2)}
              </span>
            ) : expenseVariance < 0 ? (
              <span className="text-xs text-error">
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
                <span className="text-sm font-semibold text-success">
                  ${summary.totalSavingsActual.toFixed(2)} actual
                </span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  savingsStatus === 'ahead'
                    ? 'bg-success'
                    : savingsStatus === 'on_track'
                    ? 'bg-income'
                    : 'bg-warning'
                }`}
                style={{ width: `${Math.min(100, savingsPercentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {savingsPercentage.toFixed(1)}%
              </span>
              {savingsVariance > 0 ? (
                <span className="text-xs text-success">
                  ✓ Ahead by ${Math.abs(savingsVariance).toFixed(2)}
                </span>
              ) : savingsVariance < 0 ? (
                <span className="text-xs text-warning">
                  Behind by ${Math.abs(savingsVariance).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">On target</span>
              )}
            </div>
          </div>
        )}

        {/* Debt Payments */}
        {debtData && debtData.debts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                Debt Payments
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  ${debtData.totalRecommendedPayments.toFixed(2)} recommended
                </span>
                <span className="text-sm font-semibold text-expense">
                  ${debtData.totalActualPaid.toFixed(2)} paid
                </span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-lg h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  debtData.totalActualPaid >= debtData.totalRecommendedPayments
                    ? 'bg-success'
                    : debtData.totalActualPaid >= debtData.totalRecommendedPayments * 0.8
                    ? 'bg-warning'
                    : 'bg-expense'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    debtData.totalRecommendedPayments > 0
                      ? (debtData.totalActualPaid / debtData.totalRecommendedPayments) * 100
                      : 0
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {debtData.totalRecommendedPayments > 0
                  ? ((debtData.totalActualPaid / debtData.totalRecommendedPayments) * 100).toFixed(1)
                  : 0}
                %
              </span>
              {debtData.totalActualPaid >= debtData.totalRecommendedPayments ? (
                <span className="text-xs text-success">
                  ✓ All payments made
                </span>
              ) : (
                <span className="text-xs text-expense">
                  ${(debtData.totalRecommendedPayments - debtData.totalActualPaid).toFixed(2)} remaining
                </span>
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
                  ? 'text-success'
                  : summary.adherenceScore >= 70
                  ? 'text-income'
                  : summary.adherenceScore >= 50
                  ? 'text-warning'
                  : 'text-error'
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
