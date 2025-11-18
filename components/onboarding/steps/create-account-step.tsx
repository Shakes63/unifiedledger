'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { AccountForm } from '@/components/accounts/account-form';
import { Wallet, CheckCircle2 } from 'lucide-react';
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
        description="Demo accounts have been created automatically. You can explore them after onboarding."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
          </div>
          <p className="text-muted-foreground">
            Demo accounts have been created automatically. You can explore them after onboarding.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={3}
      title="Create Your First Account"
      description="Accounts represent where your money lives - checking accounts, savings, credit cards, etc."
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

        <div className="bg-elevated border border-border rounded-lg p-4 mb-4">
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

