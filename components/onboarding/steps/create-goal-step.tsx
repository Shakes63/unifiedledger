'use client';

import { useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { GoalForm } from '@/components/goals/goal-form';
import { Target } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { toast } from 'sonner';

interface CreateGoalStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateGoalStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateGoalStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      const response = await postWithHousehold('/api/savings-goals', formData);

      if (response.ok || response.status === 201) {
        toast.success('Goal created successfully');
        onNext();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      toast.error('Failed to create goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingStep
      stepNumber={5}
      title="Create Your First Savings Goal"
      description="Goals help you save for specific purposes - vacations, emergencies, big purchases, etc."
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
            <Target className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-4 mb-4">
          <p className="text-sm text-muted-foreground">
            We've pre-filled an example goal. Track your progress and celebrate milestones as you
            save!
          </p>
        </div>

        <GoalForm
          goal={{
            name: 'Emergency Fund',
            targetAmount: 5000,
            currentAmount: 0,
            category: 'emergency_fund',
            color: '#10b981',
          }}
          onSubmit={handleSubmit}
          onCancel={onPrevious}
          isLoading={isSubmitting}
        />
      </div>
    </OnboardingStep>
  );
}

