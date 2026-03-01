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
    const totalTransactions = incomeCount + expenseCount + transferCount;
    const totalBills = billDueCount + billOverdueCount;

    if (totalTransactions === 0 && totalBills === 0 && goalCount === 0 && debtCount === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-1 mt-auto pt-0.5">
        {/* Tiny colored dots for transaction types */}
        <div className="flex items-center gap-0.5">
          {incomeCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${incomeCount} income`}
              style={{ backgroundColor: 'var(--color-income)' }}
            />
          )}
          {expenseCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${expenseCount} expense`}
              style={{ backgroundColor: 'var(--color-expense)' }}
            />
          )}
          {transferCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${transferCount} transfer`}
              style={{ backgroundColor: 'var(--color-transfer)' }}
            />
          )}
          {billOverdueCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${billOverdueCount} overdue`}
              style={{ backgroundColor: 'var(--color-error)' }}
            />
          )}
          {goalCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${goalCount} goals`}
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
          {debtCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              title={`${debtCount} debts`}
              style={{ backgroundColor: 'var(--color-error)' }}
            />
          )}
        </div>
        {/* Total spent as tiny monospace text */}
        {totalSpent !== undefined && totalSpent > 0 && (
          <span
            className="text-[8px] font-mono tabular-nums ml-auto"
            style={{ color: 'var(--color-expense)' }}
          >
            -${Math.abs(totalSpent).toFixed(0)}
          </span>
        )}
      </div>
    );
  }

  // Full view for day detail modal
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Transactions */}
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Transactions</span>
          <DollarSign className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
        </div>
        <div className="space-y-1">
          {incomeCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: 'var(--color-income)' }}>
                <TrendingUp className="w-3 h-3" />
                Income
              </span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{incomeCount}</span>
            </div>
          )}
          {expenseCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: 'var(--color-expense)' }}>
                <TrendingDown className="w-3 h-3" />
                Expenses
              </span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{expenseCount}</span>
            </div>
          )}
          {transferCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: 'var(--color-transfer)' }}>
                <ArrowRightLeft className="w-3 h-3" />
                Transfers
              </span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{transferCount}</span>
            </div>
          )}
          {totalSpent !== undefined && totalSpent > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Total Spent</span>
              <span className="font-medium font-mono tabular-nums" style={{ color: 'var(--color-expense)' }}>
                ${Math.abs(totalSpent).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bills */}
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Bills</span>
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
        </div>
        <div className="space-y-1">
          {billOverdueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--color-destructive)' }}>
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
              <span className="font-medium" style={{ color: 'var(--color-destructive)' }}>{billOverdueCount}</span>
            </div>
          )}
          {billDueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
                <AlertCircle className="w-3 h-3" />
                Due Soon
              </span>
              <span className="font-medium" style={{ color: 'var(--color-warning)' }}>{billDueCount}</span>
            </div>
          )}
          {billOverdueCount === 0 && billDueCount === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No bills on this day</p>
          )}
        </div>
      </div>

      {/* Goals */}
      {goalCount > 0 && (
        <div className="rounded-lg p-3 col-span-2" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Goal Deadlines</span>
            <Target className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
              <Target className="w-3 h-3" />
              Target Date
            </span>
            <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{goalCount}</span>
          </div>
        </div>
      )}

      {/* Debts */}
      {debtCount > 0 && (
        <div className="rounded-lg p-3 col-span-2" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Debt Milestones</span>
            <CreditCard className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1" style={{ color: 'var(--color-destructive)' }}>
              <CreditCard className="w-3 h-3" />
              Payoff Dates
            </span>
            <span className="font-medium" style={{ color: 'var(--color-destructive)' }}>{debtCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
