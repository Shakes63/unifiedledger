'use client';

import { useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { DebtForm } from '@/components/debts/debt-form';
import { CreditCard } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { toast } from 'sonner';

interface CreateDebtStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateDebtStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateDebtStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      const response = await postWithHousehold('/api/debts', formData);

      if (response.ok || response.status === 201) {
        toast.success('Debt created successfully');
        onNext();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create debt');
      }
    } catch (error) {
      console.error('Error creating debt:', error);
      toast.error('Failed to create debt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingStep
      stepNumber={6}
      title="Track Your First Debt"
      description="Debts help you track what you owe - credit cards, loans, mortgages, etc."
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
            <CreditCard className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-4 mb-4">
          <p className="text-sm text-muted-foreground">
            We've pre-filled an example debt. Track your progress and see payoff projections!
          </p>
        </div>

        <DebtForm
          debt={{
            name: 'Credit Card',
            type: 'credit_card',
            remainingBalance: 1000,
            originalAmount: 1000,
            interestRate: 18,
            interestType: 'compound',
            color: '#ef4444',
          }}
          onSubmit={handleSubmit}
          onCancel={onPrevious}
          isLoading={isSubmitting}
        />
      </div>
    </OnboardingStep>
  );
}

