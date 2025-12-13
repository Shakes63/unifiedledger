'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { GoalForm } from '@/components/goals/goal-form';
import { Target, CheckCircle2 } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
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
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo goals already created)
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

  // Show skip message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={7}
        title="Demo Goals Created"
        description="Demo savings goals are ready with progress bars and milestones to explore."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-(--color-success)/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-(--color-success)" />
          </div>
          <p className="text-muted-foreground">
            Demo savings goals with progress tracking are ready for you to explore.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={7}
      title="Create Your First Savings Goal"
      description="Track savings progress with visual milestones at 25%, 50%, 75% and automatic celebrations when you hit targets."
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
            <Target className="w-8 h-8 text-(--color-primary)" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'Visual progress bar shows how close you are',
            'Celebrate milestones at 25%, 50%, 75%, and 100%',
            'Link to a savings account to track contributions',
            'Target date projections help you plan your saving',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ve pre-filled an example goal. Track your progress and celebrate milestones as you
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

