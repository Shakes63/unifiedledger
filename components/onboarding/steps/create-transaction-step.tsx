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
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <p className="text-muted-foreground">
            Demo transactions are ready for you to explore and search.
          </p>
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
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-primary" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'Auto-categorization learns from your spending patterns',
            'Import transactions from bank CSV exports',
            'Split single transactions across multiple categories',
            'Powerful search with filters for date, amount, category, and more',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Record a transaction to see how the system tracks your spending. You can import
            transactions from CSV files later!
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <TransactionForm
            defaultType="expense"
            onEditSuccess={handleSuccess}
          />
        </div>
      </div>
    </OnboardingStep>
  );
}

