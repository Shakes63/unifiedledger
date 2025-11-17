'use client';

import { useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { BillForm } from '@/components/bills/bill-form';
import { Receipt } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

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

  return (
    <OnboardingStep
      stepNumber={4}
      title="Set Up Your First Bill"
      description="Bills help you track recurring expenses like rent, utilities, subscriptions, etc."
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
            <Receipt className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-4 mb-4">
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

