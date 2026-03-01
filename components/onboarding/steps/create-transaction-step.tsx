'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { DollarSign, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
import { toast } from 'sonner';
import type { Account } from '@/lib/types';

interface CreateTransactionStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateTransactionStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateTransactionStepProps) {
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, _setIsSubmitting] = useState(false);
  const [_accounts, setAccounts] = useState<Account[]>([]);
  const { fetchWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo transactions already created)
  useEffect(() => {
    if (isDemoMode) {
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, onNext]);

  // Fetch accounts for the transaction form
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await fetchWithHousehold('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          setAccounts(data || []);
        }
      } catch (error) {
        console.error('Failed to load accounts:', error);
      }
    };
    loadAccounts();
  }, [fetchWithHousehold]);

  const handleSuccess = () => {
    toast.success('Transaction created successfully');
    onNext();
  };

  // Show skip message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={5}
        title="Demo Transactions Created"
        description="Demo transactions are ready to show you how the spending tracker and search work."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Demo transactions are ready for you to explore and search.</p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={5}
      title="Record Your First Transaction"
      description="Record spending with smart suggestions that auto-fill categories and merchants based on your history."
      onNext={() => {}}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      hideFooter={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <DollarSign className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>

        <WhyThisMatters benefits={['Auto-categorization learns from your spending patterns', 'Import transactions from bank CSV exports', 'Split single transactions across multiple categories', 'Powerful search with filters for date, amount, category, and more']} />

        <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Record a transaction to see how the system tracks your spending. You can import transactions from CSV files later!</p>
        </div>

        <div className="rounded-xl px-4 py-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <TransactionForm defaultType="expense" onEditSuccess={handleSuccess} />
        </div>
      </div>
    </OnboardingStep>
  );
}

