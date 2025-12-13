'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, DollarSign, TrendingDown } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  principalAmount?: number;
  interestAmount?: number;
  notes?: string;
  transactionId?: string;
}

interface PaymentHistoryListProps {
  debtId: string;
  className?: string;
  initialLimit?: number;
}

export function PaymentHistoryList({
  debtId,
  className = '',
  initialLimit = 5,
}: PaymentHistoryListProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithHousehold(`/api/debts/${debtId}/payments`);
        if (!response.ok) {
          throw new Error('Failed to fetch payment history');
        }

        const data = await response.json();
        // Sort by date descending (newest first)
        const sorted = data.sort((a: Payment, b: Payment) =>
          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
        setPayments(sorted);
      } catch (err) {
        console.error('Error fetching payment history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [debtId, selectedHouseholdId, fetchWithHousehold]);

  // Calculate running balance (working backwards from newest to oldest)
  const paymentsWithBalance = payments.map((payment, index, arr) => {
    // Sum all payments from this one backwards
    const totalPaid = arr.slice(index).reduce((sum, p) => sum + p.amount, 0);
    return {
      ...payment,
      runningBalance: totalPaid,
    };
  });

  const displayPayments = showAll
    ? paymentsWithBalance
    : paymentsWithBalance.slice(0, initialLimit);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get relative time
  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  // Determine if payment is large (> $500 or > 3x average)
  const averagePayment = payments.length > 0
    ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length
    : 0;
  const isLargePayment = (amount: number) =>
    amount > 500 || amount > averagePayment * 3;

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 bg-elevated rounded-lg animate-pulse"
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-border rounded w-24"></div>
              <div className="h-3 bg-border rounded w-32"></div>
            </div>
            <div className="h-4 bg-border rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-4 bg-error/10 border border-error/30 rounded-lg ${className}`}>
        <p className="text-sm text-error">
          {error}
        </p>
      </div>
    );
  }

  // Empty state
  if (payments.length === 0) {
    return (
      <div className={`text-center p-6 bg-elevated border border-border rounded-lg ${className}`}>
        <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">
          No payments recorded yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Payments will appear here as you record them
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Payment list */}
      <div className="space-y-2">
        {displayPayments.map((payment, _index) => {
          const isLarge = isLargePayment(payment.amount);
          const hasPrincipalInterest = payment.principalAmount !== undefined && payment.interestAmount !== undefined;

          return (
            <div
              key={payment.id}
              className={`
                flex items-start justify-between p-3 rounded-lg transition-colors
                ${isLarge
                  ? 'bg-accent/10 border border-accent/30'
                  : 'bg-elevated border border-border'
                }
                hover:bg-border/20
              `}
            >
              {/* Left side: Date and amount */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="text-sm font-semibold text-foreground">
                    {formatDate(payment.paymentDate)}
                  </div>
                  {isLarge && (
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                      Large Payment
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground ml-5">
                  {getRelativeTime(payment.paymentDate)}
                </div>
                {payment.notes && (
                  <div className="text-xs text-muted-foreground ml-5 mt-1 italic">
                    {payment.notes}
                  </div>
                )}
              </div>

              {/* Right side: Amount and breakdown */}
              <div className="text-right ml-4">
                <div className="text-base font-bold text-foreground font-mono">
                  ${payment.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                {hasPrincipalInterest && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="w-3 h-3 text-chart-principal" />
                      <span className="text-chart-principal">
                        ${payment.principalAmount!.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-muted-foreground">principal</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-chart-interest">
                        ${payment.interestAmount!.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-muted-foreground">interest</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show all/less toggle */}
      {payments.length > initialLimit && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full p-2 text-sm text-accent hover:text-accent-foreground hover:bg-accent/10 rounded-lg transition-colors"
        >
          {showAll
            ? `Show Less (${initialLimit} of ${payments.length})`
            : `Show All ${payments.length} Payments`
          }
        </button>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg mt-4">
        <span className="text-sm text-muted-foreground">Total Payments</span>
        <div className="text-right">
          <div className="text-base font-bold text-foreground font-mono">
            ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
          </div>
        </div>
      </div>
    </div>
  );
}
