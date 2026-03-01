'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { BillForm } from '@/components/bills/bill-form';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
import { toast } from 'sonner';
import type { BillTemplateUpsertPayload } from '@/components/bills/bill-form';

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

  const handleSubmit = async (formData: BillTemplateUpsertPayload) => {
    try {
      setIsSubmitting(true);
      const response = await postWithHousehold('/api/bills/templates', formData as unknown as Record<string, unknown>);

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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Demo bills with upcoming due dates are ready for you to explore.</p>
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
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <Receipt className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>

        <WhyThisMatters benefits={['Get reminders before bills are due — never miss a payment', 'Transactions auto-match to bills when you record them', 'View payment history and track amount changes', 'Supports one-time, weekly, monthly, and annual bills']} />

        <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>We&apos;ve pre-filled an example bill. The system will automatically match transactions to your bills when you record payments.</p>
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

