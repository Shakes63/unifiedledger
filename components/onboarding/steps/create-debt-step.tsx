'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { DebtForm } from '@/components/debts/debt-form';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
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
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo debts already created)
  useEffect(() => {
    if (isDemoMode) {
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, onNext]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
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

  // Show skip message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={8}
        title="Demo Debt Created"
        description="Demo debt is ready with payoff projections and interest calculations to explore."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-(--color-success)/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-(--color-success)" />
          </div>
          <p className="text-muted-foreground">
            Demo debt with payoff projections is ready for you to explore.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={8}
      title="Track Your First Debt"
      description="See your debt-free date with interest projections and compare snowball vs avalanche payoff strategies."
      onNext={() => {}}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      hideFooter={true}
      isOptional={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-(--color-primary)/20 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-(--color-primary)" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'See your estimated payoff date',
            'Track interest costs and total amount paid',
            'Celebrate becoming debt-free with milestone alerts',
            'Compare snowball vs avalanche payoff strategies',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ve pre-filled an example debt. Track your progress and see payoff projections!
          </p>
        </div>

        <DebtForm
          debt={{
            name: 'Credit Card',
            type: 'credit_card',
            remainingBalance: 1000,
            originalAmount: 1000,
            interestRate: 18,
            interestType: 'variable',
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

