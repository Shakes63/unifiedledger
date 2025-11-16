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
        const debtSchedule = data.schedules?.find((s: any) => s.debtId === debt.id);

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
          payoffOrder: data.payoffOrder.filter((o: any) => o.debtId === debt.id),
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
      <div className={`p-4 bg-elevated border border-border rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground text-center">
          This debt has no interest, so there's no amortization schedule to display.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={`p-8 bg-card border border-border rounded-lg ${className}`}>
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">Loading amortization schedule...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !strategy) {
    return (
      <div className={`p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg ${className}`}>
        <p className="text-sm text-[var(--color-error)]">
          {error || 'Unable to load amortization schedule'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
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
