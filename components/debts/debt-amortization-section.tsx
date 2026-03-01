'use client';

import { useEffect, useState } from 'react';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';
import { AmortizationScheduleView } from './amortization-schedule-view';
import { Loader2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Debt {
  id: string;
  name: string;
  remainingBalance: number;
  minimumPayment?: number;
  interestRate: number;
  type: string;
  loanType?: 'revolving' | 'installment';
  compoundingFrequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays?: number;
}

interface DebtAmortizationSectionProps {
  debt: Debt;
  className?: string;
}

export function DebtAmortizationSection({
  debt,
  className = '',
}: DebtAmortizationSectionProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [strategy, setStrategy] = useState<PayoffStrategyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategy = async () => {
      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch debt settings to get extra payment and method
        const settingsResponse = await fetchWithHousehold('/api/debts/settings');
        const settings = settingsResponse.ok ? await settingsResponse.json() : null;

        const extraPayment = settings?.extraMonthlyPayment || 0;
        const method = settings?.preferredMethod || 'avalanche';
        const frequency = settings?.paymentFrequency || 'monthly';

        // Fetch payoff strategy for this debt
        const response = await fetchWithHousehold(`/api/debts/payoff-strategy?extraPayment=${extraPayment}&method=${method}&paymentFrequency=${frequency}`);

        if (!response.ok) {
          throw new Error('Failed to fetch payoff strategy');
        }

        const data = await response.json();

        // Filter to only this debt's schedule
        const debtSchedule = data.schedules?.find((s: { debtId: string }) => s.debtId === debt.id);

        if (!debtSchedule) {
          throw new Error('Schedule not found for this debt');
        }

        // Create a strategy result with just this one debt
        const singleDebtStrategy: PayoffStrategyResult = {
          method: data.method,
          paymentFrequency: data.paymentFrequency,
          totalMonths: debtSchedule.monthsToPayoff,
          totalInterestPaid: debtSchedule.totalInterestPaid,
          debtFreeDate: new Date(debtSchedule.payoffDate),
          payoffOrder: data.payoffOrder.filter((o: { debtId: string }) => o.debtId === debt.id),
          nextRecommendedPayment: data.nextRecommendedPayment?.debtId === debt.id
            ? data.nextRecommendedPayment
            : {
                debtId: debt.id,
                debtName: debt.name,
                currentBalance: debt.remainingBalance,
                recommendedPayment: debt.minimumPayment || 0,
                monthsUntilPayoff: debtSchedule.monthsToPayoff,
                totalInterest: debtSchedule.totalInterestPaid,
              },
          schedules: [debtSchedule],
          rolldownPayments: data.rolldownPayments?.filter((r: { debtId: string }) => r.debtId === debt.id) || [],
        };

        setStrategy(singleDebtStrategy);
      } catch (err) {
        console.error('Error fetching amortization strategy:', err);
        setError(err instanceof Error ? err.message : 'Failed to load amortization schedule');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if debt has interest rate
    if (debt.interestRate > 0) {
      fetchStrategy();
    } else {
      setLoading(false);
    }
  }, [debt.id, debt.interestRate, debt.name, debt.remainingBalance, debt.minimumPayment, selectedHouseholdId, fetchWithHousehold]);

  // No interest rate - don't show amortization
  if (debt.interestRate === 0) {
    return (
      <div className={`p-4 rounded-lg ${className}`} style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm text-center" style={{ color: 'var(--color-muted-foreground)' }}>
          This debt has no interest, so there&apos;s no amortization schedule to display.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={`p-8 rounded-lg ${className}`} style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--color-accent)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading amortization schedule...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !strategy) {
    return (
      <div className={`p-4 rounded-lg ${className}`} style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error || 'Unable to load amortization schedule'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          Try refreshing the page or contact support if the issue persists.
        </p>
      </div>
    );
  }

  // Success - show amortization schedule
  return (
    <div className={className}>
      <AmortizationScheduleView strategy={strategy} />
    </div>
  );
}
