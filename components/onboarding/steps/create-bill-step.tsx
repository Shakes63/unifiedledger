'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { BillForm } from '@/components/bills/bill-form';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
import { toast } from 'sonner';

interface CreateBillStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateBillStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateBillStepProps) {
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo bills already created)
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
      const response = await postWithHousehold('/api/bills', formData);

      if (response.ok || response.status === 201) {
        toast.success('Bill created successfully');
        onNext();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create bill');
      }
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error('Failed to create bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show skip message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={6}
        title="Demo Bills Created"
        description="Demo bills are ready with upcoming due dates to show you reminders and payment matching."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
          </div>
          <p className="text-muted-foreground">
            Demo bills with upcoming due dates are ready for you to explore.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={6}
      title="Set Up Your First Bill"
      description="Never miss a payment - bills auto-match transactions and send reminders before due dates."
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
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <Receipt className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'Get reminders before bills are due - never miss a payment',
            'Transactions auto-match to bills when you record them',
            'View payment history and track amount changes',
            'Supports one-time, weekly, monthly, and annual bills',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            We've pre-filled an example bill. The system will automatically match transactions to
            your bills when you record payments.
          </p>
        </div>

        <BillForm
          bill={{
            name: 'Monthly Rent',
            expectedAmount: 1000,
            dueDate: 1,
            frequency: 'monthly',
            isVariableAmount: false,
            autoMarkPaid: true,
          }}
          onSubmit={handleSubmit}
          onCancel={onPrevious}
          isLoading={isSubmitting}
        />
      </div>
    </OnboardingStep>
  );
}

