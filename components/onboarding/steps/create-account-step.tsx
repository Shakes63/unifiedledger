'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { AccountForm } from '@/components/accounts/account-form';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
import { toast } from 'sonner';

interface CreateAccountStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateAccountStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateAccountStepProps) {
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo accounts already created)
  useEffect(() => {
    if (isDemoMode) {
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, onNext]);

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      const response = await postWithHousehold('/api/accounts', formData);

      if (response.ok || response.status === 201) {
        toast.success('Account created successfully');
        onNext();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show skip message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={3}
        title="Demo Accounts Created"
        description="Demo accounts are ready with sample balances and transaction history to explore."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
          </div>
          <p className="text-muted-foreground">
            Demo accounts with sample balances are ready for you to explore.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={3}
      title="Create Your First Account"
      description="See all balances in one place with automatic transfer detection and credit card utilization alerts."
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
            <Wallet className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'See all your balances in one dashboard',
            'Credit cards show utilization and available credit',
            'Track spending patterns per account',
            'Automatic transfer tracking between accounts',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            We've pre-filled an example account. Feel free to modify it or create your own.
          </p>
        </div>

        <AccountForm
          account={{
            name: 'Checking Account',
            type: 'checking',
            currentBalance: 0,
            color: '#3b82f6',
            icon: 'wallet',
          }}
          onSubmit={handleSubmit}
          onCancel={onPrevious}
          isLoading={isSubmitting}
        />
      </div>
    </OnboardingStep>
  );
}

