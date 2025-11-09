'use client';

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';
import { Check, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ name: string; status: string; amount: number }>;
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
  onDayClick,
}: CalendarWeekProps) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const [weekTransactions, setWeekTransactions] = useState<Record<string, Transaction[]>>({});
  const [loading, setLoading] = useState(true);

  // Fetch transactions for the week
  useEffect(() => {
    const fetchWeekTransactions = async () => {
      setLoading(true);
      const transactions: Record<string, Transaction[]> = {};

      for (const day of days) {
        const dayKey = format(day, 'yyyy-MM-dd');
        try {
          const response = await fetch(`/api/calendar/day?date=${day.toISOString()}`);
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
  }, [currentDate]);

  return (
    <div className="space-y-4">
      {/* Week date range */}
      <div className="text-center text-muted-foreground text-sm mb-4">
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
              className={`p-3 rounded-lg border-2 transition-all flex flex-col min-h-[300px] ${
                isTodayDate
                  ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]'
                  : 'bg-card border-border'
              }`}
            >
              {/* Day name and date */}
              <div className="text-center mb-3 pb-2 border-b border-border">
                <p className="text-xs text-muted-foreground font-medium">
                  {format(day, 'EEE')}
                </p>
                <p
                  className={`text-lg font-bold ${
                    isTodayDate ? 'text-[var(--color-primary)]' : 'text-foreground'
                  }`}
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
                      className={`text-[10px] px-1.5 py-1 rounded flex items-center gap-0.5 ${
                        bill.status === 'overdue'
                          ? 'bg-[var(--color-error)]/20 text-[var(--color-error)] font-semibold'
                          : bill.status === 'paid'
                          ? 'bg-[var(--color-income)]/20 text-[var(--color-income)]'
                          : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
                      }`}
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

              {/* Transactions List */}
              {loading ? (
                <div className="text-muted-foreground text-xs text-center py-4">Loading...</div>
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
                        className="text-[10px] px-1.5 py-1 rounded bg-elevated hover:bg-[var(--color-elevated)] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {displayName}
                            </div>
                            {!isTransfer && txn.merchant && txn.merchant.trim() !== '' && txn.description !== txn.merchant && (
                              <div className="truncate text-muted-foreground text-[9px]">
                                {txn.description}
                              </div>
                            )}
                          </div>
                          <div className={`font-semibold shrink-0 ${
                            txn.type === 'income' ? 'text-[var(--color-income)]' :
                            txn.type === 'expense' ? 'text-[var(--color-expense)]' :
                            'text-[var(--color-primary)]'
                          }`}>
                            {txn.type === 'expense' || txn.type === 'transfer_out' ? '-' : '+'}
                            ${Math.abs(txn.amount).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs text-center py-4">No transactions</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
