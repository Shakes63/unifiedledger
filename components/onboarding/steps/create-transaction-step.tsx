'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { DollarSign } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { toast } from 'sonner';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const { fetchWithHousehold } = useHouseholdFetch();

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

  return (
    <OnboardingStep
      stepNumber={7}
      title="Record Your First Transaction"
      description="Transactions are the foundation of your financial tracking - income, expenses, and transfers."
      onNext={() => {}}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      hideFooter={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-4 mb-4">
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

