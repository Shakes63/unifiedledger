'use client';

import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionIndicators } from './transaction-indicators';
import { TrendingDown, TrendingUp, ArrowRightLeft, Plus, Target, CreditCard, Trophy } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category?: string;
}

interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
}

interface Goal {
  id: string;
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  color: string;
  icon: string;
  status: string;
  category?: string | null;
}

interface Debt {
  id: string;
  name: string;
  description?: string | null;
  creditorName: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  color: string;
  icon: string;
  type: string;
  status: string;
  debtType: 'target' | 'milestone';
  milestonePercentage?: number;
}

interface CalendarDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  transactions?: Transaction[];
  bills?: Bill[];
  goals?: Goal[];
  debts?: Debt[];
  transactionCounts?: {
    incomeCount: number;
    expenseCount: number;
    transferCount: number;
    totalSpent: number;
    billDueCount: number;
    billOverdueCount: number;
    goalCount?: number;
    debtCount?: number;
  };
}

export function CalendarDayModal({
  open,
  onOpenChange,
  date,
  transactions = [],
  bills = [],
  goals = [],
  debts = [],
  transactionCounts,
}: CalendarDayModalProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <TrendingUp className="w-4 h-4 text-[var(--color-income)]" />;
      case 'expense':
        return <TrendingDown className="w-4 h-4 text-[var(--color-expense)]" />;
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4 text-[var(--color-transfer)]" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-[var(--color-income)]';
      case 'expense':
        return 'text-[var(--color-expense)]';
      case 'transfer_in':
      case 'transfer_out':
        return 'text-[var(--color-transfer)]';
      default:
        return 'text-foreground';
    }
  };

  const getBillStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-[var(--color-income)]/10 text-[var(--color-income)]';
      case 'overdue':
        return 'bg-[var(--color-error)]/10 text-[var(--color-error)]';
      case 'pending':
        return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';
      default:
        return 'bg-muted/10 text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            View and manage transactions and bills for this day
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Indicators */}
          {transactionCounts && (
            <TransactionIndicators
              incomeCount={transactionCounts.incomeCount}
              expenseCount={transactionCounts.expenseCount}
              transferCount={transactionCounts.transferCount}
              billDueCount={transactionCounts.billDueCount}
              billOverdueCount={transactionCounts.billOverdueCount}
              goalCount={transactionCounts.goalCount || goals.length}
              debtCount={transactionCounts.debtCount || debts.length}
              totalSpent={transactionCounts.totalSpent}
              compact={false}
            />
          )}

          {/* Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">
                Transactions ({transactions.length})
              </h3>
              <Link href="/dashboard/transactions/new">
                <Button
                  size="sm"
                  className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </Link>
            </div>

            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 bg-elevated rounded-lg border border-border hover:border-border transition"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getTransactionIcon(txn.type)}
                      <div>
                        <p className="font-medium text-foreground">
                          {txn.description}
                        </p>
                        {txn.category && (
                          <p className="text-muted-foreground text-sm">
                            {txn.category}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className={`font-semibold ${getTransactionColor(txn.type)}`}>
                      {txn.type === 'expense' || txn.type === 'transfer_out'
                        ? '-'
                        : '+'}
                      ${Math.abs(txn.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No transactions on this day
              </p>
            )}
          </div>

          {/* Bills */}
          {bills.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Bills ({bills.length})
              </h3>
              <div className="space-y-2">
                {bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 bg-elevated rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {bill.description}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Due: {format(parseISO(bill.dueDate), 'MMM d')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-[var(--color-expense)]">
                        ${bill.amount.toFixed(2)}
                      </p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getBillStatusColor(
                          bill.status
                        )}`}
                      >
                        {bill.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground">
                  Goal Deadlines ({goals.length})
                </h3>
                <Link href="/dashboard/goals">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border hover:bg-elevated"
                  >
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="p-3 bg-elevated rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg shrink-0"
                        style={{ backgroundColor: `${goal.color}20` }}
                      >
                        <Target
                          className="w-5 h-5"
                          style={{ color: goal.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground truncate">
                            {goal.name}
                          </p>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold capitalize shrink-0"
                            style={{
                              backgroundColor: `${goal.color}20`,
                              color: goal.color,
                            }}
                          >
                            {goal.status}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-muted-foreground text-sm mt-1 truncate">
                            {goal.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm text-muted-foreground">
                            ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: goal.color }}
                          >
                            {goal.progress}%
                          </p>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(goal.progress, 100)}%`,
                              backgroundColor: goal.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debts */}
          {debts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground">
                  Debt Milestones ({debts.length})
                </h3>
                <Link href="/dashboard/debts">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border hover:bg-elevated"
                  >
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="p-3 bg-elevated rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg shrink-0"
                        style={{ backgroundColor: `${debt.color}20` }}
                      >
                        {debt.debtType === 'milestone' ? (
                          <Trophy
                            className="w-5 h-5"
                            style={{ color: debt.color }}
                          />
                        ) : (
                          <CreditCard
                            className="w-5 h-5"
                            style={{ color: debt.color }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground truncate">
                            {debt.name}
                          </p>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold capitalize shrink-0"
                            style={{
                              backgroundColor: `${debt.color}20`,
                              color: debt.color,
                            }}
                          >
                            {debt.debtType === 'milestone' 
                              ? `${debt.milestonePercentage}% Milestone`
                              : 'Target Date'}
                          </span>
                        </div>
                        {debt.description && (
                          <p className="text-muted-foreground text-sm mt-1 truncate">
                            {debt.description}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs mt-1">
                          {debt.creditorName}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm text-muted-foreground">
                            ${(debt.originalAmount - debt.remainingBalance).toLocaleString()} / ${debt.originalAmount.toLocaleString()} paid
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: debt.color }}
                          >
                            {debt.progress}%
                          </p>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(debt.progress, 100)}%`,
                              backgroundColor: debt.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length === 0 && bills.length === 0 && goals.length === 0 && debts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No activity on this day
              </p>
              <Link href="/dashboard/transactions/new">
                <Button className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
