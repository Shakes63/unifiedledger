'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  AlertCircle,
  Clock,
  CreditCard,
  Zap,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Decimal from 'decimal.js';
import type { BillOccurrenceWithTemplateDto } from '@/lib/bills/contracts';

interface LinkedAccount {
  id: string;
  name: string;
  type: 'credit' | 'line_of_credit';
  currentBalance: number;
  creditLimit: number;
}

interface NextDueBill {
  id: string;
  billId: string;
  billName: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: 'pending' | 'overdue';
  daysUntilDue: number;
  isOverdue: boolean;
  linkedAccount?: LinkedAccount;
  isAutopay: boolean;
  autopayAmount?: number;
  autopayDays?: number;
  autopayAmountType?: string;
  billColor?: string;
  isDebt: boolean;
}

interface NextDueSummary {
  overdueCount: number;
  overdueTotal: number;
  nextDueDate: string | null;
  next7DaysTotal: number;
  next7DaysCount: number;
  totalPendingCount: number;
}

interface NextDueResponse {
  bills: NextDueBill[];
  summary: NextDueSummary;
}

const CREDIT_ACCOUNT_TYPES = new Set(['credit', 'line_of_credit']);

export function NextPaymentDueWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<NextDueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [occurrencesResponse, accountsResponse] = await Promise.all([
        fetchWithHousehold('/api/bills/occurrences?status=unpaid,partial,overdue&limit=5000'),
        fetchWithHousehold('/api/accounts'),
      ]);

      if (!occurrencesResponse.ok) {
        throw new Error('Failed to fetch next due bills');
      }

      const occurrencesResult = await occurrencesResponse.json();
      const rows = (Array.isArray(occurrencesResult?.data) ? occurrencesResult.data : []) as BillOccurrenceWithTemplateDto[];

      const accountsResult = accountsResponse.ok ? await accountsResponse.json() : [];
      const accounts = Array.isArray(accountsResult) ? accountsResult : [];
      const accountMap = new Map(
        accounts
          .filter((account: { id: string; type: string }) => CREDIT_ACCOUNT_TYPES.has(account.type))
          .map((account: { id: string; name: string; type: 'credit' | 'line_of_credit'; currentBalance?: number; creditLimit?: number }) => [
            account.id,
            account,
          ])
      );

      const overdueRows = rows
        .filter((row) => row.occurrence.status === 'overdue')
        .sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));
      const pendingRows = rows
        .filter((row) => row.occurrence.status === 'unpaid' || row.occurrence.status === 'partial')
        .sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));

      const combined = [...overdueRows, ...pendingRows];
      const topRows = combined.slice(0, 5);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bills: NextDueBill[] = topRows.map((row) => {
        const dueDate = parseISO(row.occurrence.dueDate);
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.round((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const linkedAccount = row.template.linkedLiabilityAccountId
          ? accountMap.get(row.template.linkedLiabilityAccountId)
          : undefined;

        return {
          id: row.occurrence.id,
          billId: row.template.id,
          billName: row.template.name,
          dueDate: row.occurrence.dueDate,
          expectedAmount: row.occurrence.amountDueCents / 100,
          actualAmount: row.occurrence.actualAmountCents !== null ? row.occurrence.actualAmountCents / 100 : undefined,
          status: row.occurrence.status === 'overdue' ? 'overdue' : 'pending',
          daysUntilDue,
          isOverdue: row.occurrence.status === 'overdue',
          linkedAccount: linkedAccount
            ? {
                id: linkedAccount.id,
                name: linkedAccount.name,
                type: linkedAccount.type,
                currentBalance: Math.abs(linkedAccount.currentBalance || 0),
                creditLimit: linkedAccount.creditLimit || 0,
              }
            : undefined,
          isAutopay: false,
          isDebt: row.template.debtEnabled,
          billColor: row.template.debtColor || undefined,
        };
      });

      const next7DaysRows = pendingRows.filter((row) => {
        const dueDate = parseISO(row.occurrence.dueDate);
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);
        const days = Math.round((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 7;
      });

      const result: NextDueResponse = {
        bills,
        summary: {
          overdueCount: overdueRows.length,
          overdueTotal: overdueRows.reduce((sum, row) => sum + row.occurrence.amountDueCents / 100, 0),
          nextDueDate: pendingRows[0]?.occurrence.dueDate || null,
          next7DaysTotal: next7DaysRows.reduce((sum, row) => sum + row.occurrence.amountDueCents / 100, 0),
          next7DaysCount: next7DaysRows.length,
          totalPendingCount: pendingRows.length,
        },
      };

      setData(result);
    } catch (err) {
      console.error('Error fetching next due bills:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for bill refresh events
  useEffect(() => {
    const handleBillsRefresh = () => {
      if (selectedHouseholdId) {
        fetchData();
      }
    };

    window.addEventListener('bills-refresh', handleBillsRefresh);
    return () => window.removeEventListener('bills-refresh', handleBillsRefresh);
  }, [selectedHouseholdId, fetchData]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          boxShadow: 'inset 0 0 80px 0 rgba(0,0,0,0.03)',
        }}
      >
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="h-4 rounded w-32" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          boxShadow: 'inset 0 0 80px 0 rgba(0,0,0,0.03)',
        }}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 mb-2" style={{ color: 'var(--color-destructive)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Failed to load upcoming payments</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data or no bills
  if (!data || data.bills.length === 0) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          boxShadow: 'inset 0 0 80px 0 rgba(0,0,0,0.03)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>Next Payments</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle className="w-10 h-10 mb-2 opacity-50" style={{ color: 'var(--color-success)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>All caught up!</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>No upcoming payments due</p>
        </div>
      </div>
    );
  }

  const { bills, summary } = data;

  const formatDueDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'MMM d');
  };

  const getDaysLabel = (days: number, isOverdue: boolean) => {
    if (isOverdue) {
      const absDays = Math.abs(days);
      if (absDays === 0) return 'Due today';
      if (absDays === 1) return '1 day overdue';
      return `${absDays} days overdue`;
    }
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  };

  const getStatusColor = (bill: NextDueBill) => {
    if (bill.isOverdue) return 'var(--color-destructive)';
    if (bill.daysUntilDue <= 2) return 'var(--color-warning)';
    return 'var(--color-primary)';
  };

  const formatAmount = (amount: number) => {
    return new Decimal(amount).toFixed(2);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        position: 'relative',
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
        borderTopWidth: '2px',
        borderTopColor: 'var(--color-primary)',
        boxShadow: 'inset 0 0 80px 0 rgba(0,0,0,0.03)',
      }}
    >
      {/* Corner gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 100% 0%, color-mix(in oklch, var(--color-primary) 3%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Next Payments</h3>
        </div>

        {/* Overdue badge */}
        {summary.overdueCount > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)',
              color: 'var(--color-destructive)',
            }}
          >
            {summary.overdueCount} overdue
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="relative flex items-center gap-3 mb-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Next 7 days: <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatAmount(summary.next7DaysTotal)}</span>
        </span>
        <span style={{ color: 'var(--color-muted-foreground)', opacity: 0.6 }}>|</span>
        <span>{summary.next7DaysCount + summary.overdueCount} bills</span>
      </div>

      {/* Bills list */}
      <div className="relative space-y-1">
        {bills.map((bill, i) => (
          <Link
            key={bill.id}
            href="/dashboard/bills"
            className="dashboard-fade-in flex items-center justify-between rounded-lg py-2 px-3 transition-colors hover:bg-(--color-elevated)"
            style={{
              borderLeft: `3px solid ${getStatusColor(bill)}`,
              backgroundColor: bill.isOverdue ? 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' : undefined,
              animationDelay: `${i * 30}ms`,
            }}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {/* Bill info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                    {bill.billName}
                  </span>

                  {/* Credit card indicator */}
                  {bill.linkedAccount && (
                    <CreditCard
                      className="w-3 h-3 shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                    />
                  )}

                  {/* Autopay indicator */}
                  {bill.isAutopay && (
                    <span title="Autopay enabled">
                      <Zap
                        className="w-3 h-3 shrink-0"
                        style={{ color: 'var(--color-income)' }}
                      />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>
                  <span
                    className={bill.isOverdue ? 'font-medium' : ''}
                    style={{ color: getStatusColor(bill), textTransform: 'none' }}
                  >
                    {getDaysLabel(bill.daysUntilDue, bill.isOverdue)}
                  </span>
                  <span>{formatDueDate(bill.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Amount */}
            <span
              className="text-sm font-bold shrink-0"
              style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}
            >
              ${formatAmount(bill.expectedAmount)}
            </span>
          </Link>
        ))}
      </div>

      {/* View all link */}
      {(summary.totalPendingCount + summary.overdueCount > bills.length) && (
        <Link
          href="/dashboard/bills"
          className="relative mt-2 flex items-center gap-1 py-1.5 text-xs hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          View all bills
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

