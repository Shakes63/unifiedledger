'use client';

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from 'date-fns';
import { Check, Target, CreditCard, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface GoalSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  status: string;
}

interface DebtSummary {
  id: string;
  name: string;
  color: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  type: 'target' | 'milestone';
  milestonePercentage?: number;
  status: string;
}

interface AutopayEventSummary {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

interface UnifiedPayoffDateSummary {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

interface BillMilestoneSummary {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt?: string;
  color?: string;
}

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ 
    name: string; 
    status: string; 
    amount: number;
    isDebt?: boolean;
    isAutopayEnabled?: boolean;
    linkedAccountName?: string;
  }>;
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
  autopayCount: number;
  autopayEvents?: AutopayEventSummary[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDateSummary[];
  billMilestoneCount: number;
  billMilestones?: BillMilestoneSummary[];
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  merchant?: string;
  accountName?: string;
}

interface CalendarWeekProps {
  currentDate: Date;
  daySummaries?: Record<string, DayTransactionSummary>;
  onDayClick?: (date: Date) => void;
}

export function CalendarWeek({
  currentDate,
  daySummaries = {},
  onDayClick: _onDayClick,
}: CalendarWeekProps) {
  const currentDateTime = currentDate.getTime();
  const weekStart = useMemo(() => startOfWeek(new Date(currentDateTime)), [currentDateTime]);
  const weekEnd = useMemo(() => endOfWeek(new Date(currentDateTime)), [currentDateTime]);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);
  const [weekTransactions, setWeekTransactions] = useState<Record<string, Transaction[]>>({});
  const [loading, setLoading] = useState(true);

  // Fetch transactions for the week
  useEffect(() => {
    const fetchWeekTransactions = async () => {
      setLoading(true);
      const transactions: Record<string, Transaction[]> = {};
      // Calculate days inside the effect to avoid stale closure
      const effectDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

      for (const day of effectDays) {
        const dayKey = format(day, 'yyyy-MM-dd');
        try {
          const response = await fetch(`/api/calendar/day?date=${day.toISOString()}`, { credentials: 'include' });
          if (response.ok) {
            const data = await response.json();
            transactions[dayKey] = data.transactions || [];
          }
        } catch (error) {
          console.error(`Error fetching transactions for ${dayKey}:`, error);
          transactions[dayKey] = [];
        }
      }

      setWeekTransactions(transactions);
      setLoading(false);
    };

    fetchWeekTransactions();
  }, [weekStart, weekEnd]);

  return (
    <div className="space-y-4">
      {/* Week date range */}
      <div className="text-center text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const summary = daySummaries[dayKey];
          const transactions = weekTransactions[dayKey] || [];
          const isTodayDate = isToday(day);

          return (
            <div
              key={dayKey}
              className="p-3 rounded-lg border-2 transition-all flex flex-col min-h-[300px]"
            style={{
              backgroundColor: isTodayDate ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'var(--color-background)',
              borderColor: isTodayDate ? 'var(--color-primary)' : 'var(--color-border)',
            }}
            >
              {/* Day name and date */}
              <div className="text-center mb-3 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                  {format(day, 'EEE')}
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: isTodayDate ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                >
                  {format(day, 'd')}
                </p>
              </div>

              {/* Bills */}
              {summary?.bills && summary.bills.length > 0 && (
                <div className="space-y-1 mb-2">
                  {summary.bills.map((bill, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] px-1.5 py-1 rounded flex items-center gap-0.5 font-semibold"
                      style={{
                        backgroundColor: bill.status === 'overdue'
                          ? 'color-mix(in oklch, var(--color-destructive) 20%, transparent)'
                          : bill.status === 'paid'
                          ? 'color-mix(in oklch, var(--color-income) 20%, transparent)'
                          : 'color-mix(in oklch, var(--color-warning) 20%, transparent)',
                        color: bill.status === 'overdue'
                          ? 'var(--color-destructive)'
                          : bill.status === 'paid'
                          ? 'var(--color-income)'
                          : 'var(--color-warning)',
                      }}
                    >
                      {bill.status === 'paid' && <Check className="w-2.5 h-2.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{bill.name}</div>
                        <div className="text-[9px] opacity-75">${bill.amount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Goals */}
              {summary?.goals && summary.goals.length > 0 && (
                <div className="space-y-1 mb-2">
                  {summary.goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="text-[10px] px-1.5 py-1 rounded flex items-center gap-0.5"
                      style={{
                        backgroundColor: `${goal.color}20`,
                        color: goal.color,
                      }}
                    >
                      <Target className="w-2.5 h-2.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{goal.name}</div>
                        <div className="text-[9px] opacity-75">
                          {goal.progress}% - ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Debts */}
              {summary?.debts && summary.debts.length > 0 && (
                <div className="space-y-1 mb-2">
                  {summary.debts.map((debt) => (
                    <div
                      key={debt.id}
                      className="text-[10px] px-1.5 py-1 rounded flex items-center gap-0.5"
                      style={{
                        backgroundColor: `${debt.color}20`,
                        color: debt.color,
                      }}
                    >
                      {debt.type === 'milestone' ? (
                        <Trophy className="w-2.5 h-2.5 shrink-0" />
                      ) : (
                        <CreditCard className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{debt.name}</div>
                        <div className="text-[9px] opacity-75">
                          {debt.progress}% - ${(debt.originalAmount - debt.remainingBalance).toLocaleString()} / ${debt.originalAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transactions List */}
              {loading ? (
                <div className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
              ) : transactions.length > 0 ? (
                <div className="space-y-1 overflow-y-auto flex-1">
                  {transactions.map((txn) => {
                    // For transfers, show the account name
                    const isTransfer = txn.type === 'transfer_in' || txn.type === 'transfer_out';
                    let displayName: string;

                    if (isTransfer) {
                      displayName = txn.accountName || txn.description;
                    } else {
                      // For regular transactions, prefer merchant over description
                      displayName = txn.merchant && txn.merchant.trim() !== ''
                        ? txn.merchant
                        : txn.description;
                    }

                    return (
                      <div
                        key={txn.id}
                        className="text-[10px] px-1.5 py-1 rounded transition-colors"
                        style={{ backgroundColor: 'var(--color-elevated)' }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium" style={{ color: 'var(--color-foreground)' }}>
                              {displayName}
                            </div>
                            {!isTransfer && txn.merchant && txn.merchant.trim() !== '' && txn.description !== txn.merchant && (
                              <div className="truncate text-[9px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                {txn.description}
                              </div>
                            )}
                          </div>
                          <div className="font-semibold shrink-0" style={{ color: txn.type === 'income' ? 'var(--color-income)' : txn.type === 'expense' ? 'var(--color-expense)' : 'var(--color-primary)' }}>
                            {txn.type === 'expense' || txn.type === 'transfer_out' ? '-' : '+'}
                            ${Math.abs(txn.amount).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>No transactions</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
