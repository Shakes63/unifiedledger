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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Demo debt with payoff projections is ready for you to explore.</p>
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
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <CreditCard className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>

        <WhyThisMatters benefits={['See your estimated payoff date', 'Track interest costs and total amount paid', 'Celebrate becoming debt-free with milestone alerts', 'Compare snowball vs avalanche payoff strategies']} />

        <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>We&apos;ve pre-filled an example debt. Track your progress and see payoff projections!</p>
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

