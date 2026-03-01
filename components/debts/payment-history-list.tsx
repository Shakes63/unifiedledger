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
  source?: 'account' | 'bill' | 'debt';
  className?: string;
  initialLimit?: number;
}

export function PaymentHistoryList({
  debtId,
  source = 'debt',
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

        const response = await fetchWithHousehold(
          `/api/debts/payments?source=${source}&id=${debtId}`
        );
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
  }, [debtId, selectedHouseholdId, fetchWithHousehold, source]);

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
            className="flex items-center justify-between p-3 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--color-elevated)' }}
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 rounded w-24" style={{ backgroundColor: 'var(--color-border)' }}></div>
              <div className="h-3 rounded w-32" style={{ backgroundColor: 'var(--color-border)' }}></div>
            </div>
            <div className="h-4 rounded w-20" style={{ backgroundColor: 'var(--color-border)' }}></div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-4 rounded-lg ${className}`}
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      </div>
    );
  }

  // Empty state
  if (payments.length === 0) {
    return (
      <div className={`text-center p-6 rounded-lg ${className}`}
        style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-muted-foreground)' }} />
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          No payments recorded yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
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
              className="flex items-start justify-between p-3 rounded-lg transition-colors"
              style={{
                backgroundColor: isLarge ? 'color-mix(in oklch, var(--color-accent) 10%, transparent)' : 'var(--color-elevated)',
                border: `1px solid ${isLarge ? 'color-mix(in oklch, var(--color-accent) 30%, transparent)' : 'var(--color-border)'}`,
              }}
            >
              {/* Left side: Date and amount */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                    {formatDate(payment.paymentDate)}
                  </div>
                  {isLarge && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>
                      Large Payment
                    </span>
                  )}
                </div>
                <div className="text-xs ml-5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {getRelativeTime(payment.paymentDate)}
                </div>
                {payment.notes && (
                  <div className="text-xs ml-5 mt-1 italic" style={{ color: 'var(--color-muted-foreground)' }}>
                    {payment.notes}
                  </div>
                )}
              </div>

              {/* Right side: Amount and breakdown */}
              <div className="text-right ml-4">
                <div className="text-base font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
                  ${payment.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                {hasPrincipalInterest && (
                  <div className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="w-3 h-3" style={{ color: 'var(--color-chart-principal)' }} />
                      <span style={{ color: 'var(--color-chart-principal)' }}>
                        ${payment.principalAmount!.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>principal</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span style={{ color: 'var(--color-chart-interest)' }}>
                        ${payment.interestAmount!.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>interest</span>
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
          className="w-full p-2 text-sm rounded-lg transition-colors"
          style={{ color: 'var(--color-accent)' }}
        >
          {showAll
            ? `Show Less (${initialLimit} of ${payments.length})`
            : `Show All ${payments.length} Payments`
          }
        </button>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg mt-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total Payments</span>
        <div className="text-right">
          <div className="text-base font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
          </div>
        </div>
      </div>
    </div>
  );
}
