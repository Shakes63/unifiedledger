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

  const handleSubmit = async (formData: Record<string, unknown>) => {
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Demo accounts with sample balances are ready for you to explore.</p>
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
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <Wallet className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>

        <WhyThisMatters benefits={['See all your balances in one dashboard', 'Credit cards show utilization and available credit', 'Track spending patterns per account', 'Automatic transfer tracking between accounts']} />

        <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>We&apos;ve pre-filled an example account. Feel free to modify it or create your own.</p>
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

