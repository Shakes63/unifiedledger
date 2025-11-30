'use client';

import { DollarSign, TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle, Target, CreditCard } from 'lucide-react';

interface TransactionIndicatorsProps {
  incomeCount?: number;
  expenseCount?: number;
  transferCount?: number;
  billDueCount?: number;
  billOverdueCount?: number;
  goalCount?: number;
  debtCount?: number;
  totalSpent?: number;
  compact?: boolean;
}

export function TransactionIndicators({
  incomeCount = 0,
  expenseCount = 0,
  transferCount = 0,
  billDueCount = 0,
  billOverdueCount = 0,
  goalCount = 0,
  debtCount = 0,
  totalSpent,
  compact = false,
}: TransactionIndicatorsProps) {
  if (compact) {
    // Compact view for calendar day cells
    const totalTransactions =
      incomeCount + expenseCount + transferCount;
    const totalBills = billDueCount + billOverdueCount;

    if (totalTransactions === 0 && totalBills === 0 && goalCount === 0 && debtCount === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {incomeCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-income)]/20 text-[var(--color-income)] text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>{incomeCount}</span>
          </div>
        )}
        {expenseCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-expense)]/20 text-[var(--color-expense)] text-xs">
            <TrendingDown className="w-3 h-3" />
            <span>{expenseCount}</span>
          </div>
        )}
        {transferCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-transfer)]/20 text-[var(--color-transfer)] text-xs">
            <ArrowRightLeft className="w-3 h-3" />
            <span>{transferCount}</span>
          </div>
        )}
        {billOverdueCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-error)]/20 text-[var(--color-error)] text-xs font-semibold">
            <AlertCircle className="w-3 h-3" />
            <span>{billOverdueCount}</span>
          </div>
        )}
        {billDueCount > 0 && billOverdueCount === 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-warning)]/20 text-[var(--color-warning)] text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{billDueCount}</span>
          </div>
        )}
        {goalCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs">
            <Target className="w-3 h-3" />
            <span>{goalCount}</span>
          </div>
        )}
        {debtCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-error)]/20 text-[var(--color-error)] text-xs">
            <CreditCard className="w-3 h-3" />
            <span>{debtCount}</span>
          </div>
        )}
      </div>
    );
  }

  // Full view for day detail modal
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Transactions */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-sm">Transactions</span>
          <DollarSign className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          {incomeCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-income)] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Income
              </span>
              <span className="font-medium text-foreground">{incomeCount}</span>
            </div>
          )}
          {expenseCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-expense)] flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Expenses
              </span>
              <span className="font-medium text-foreground">{expenseCount}</span>
            </div>
          )}
          {transferCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-transfer)] flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" />
                Transfers
              </span>
              <span className="font-medium text-foreground">{transferCount}</span>
            </div>
          )}
          {totalSpent !== undefined && totalSpent > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-medium text-[var(--color-expense)]">
                ${Math.abs(totalSpent).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bills */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-sm">Bills</span>
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          {billOverdueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-error)] flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
              <span className="font-medium text-[var(--color-error)]">
                {billOverdueCount}
              </span>
            </div>
          )}
          {billDueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-warning)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Due Soon
              </span>
              <span className="font-medium text-[var(--color-warning)]">
                {billDueCount}
              </span>
            </div>
          )}
          {billOverdueCount === 0 && billDueCount === 0 && (
            <p className="text-muted-foreground text-sm">No bills on this day</p>
          )}
        </div>
      </div>

      {/* Goals */}
      {goalCount > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Goal Deadlines</span>
            <Target className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-primary)] flex items-center gap-1">
              <Target className="w-3 h-3" />
              Target Date
            </span>
            <span className="font-medium text-[var(--color-primary)]">
              {goalCount}
            </span>
          </div>
        </div>
      )}

      {/* Debts */}
      {debtCount > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Debt Milestones</span>
            <CreditCard className="w-4 h-4 text-[var(--color-error)]" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-error)] flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Payoff Dates
            </span>
            <span className="font-medium text-[var(--color-error)]">
              {debtCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
