'use client';

import { useState, useEffect } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { CategoryForm } from '@/components/categories/category-form';
import { WhyThisMatters } from '../why-this-matters';
import { FolderTree, CheckCircle2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useOnboarding } from '@/contexts/onboarding-context';
import { toast } from 'sonner';

interface CreateCategoryStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

const COMMON_CATEGORIES = [
  'Groceries',
  'Dining Out',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
];

export function CreateCategoryStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateCategoryStepProps) {
  const { isDemoMode } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { postWithHousehold } = useHouseholdFetch();

  // Auto-advance if in demo mode (demo categories already created)
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
      const response = await postWithHousehold('/api/categories', formData);

      if (response.ok || response.status === 201) {
        toast.success('Category created successfully');
        onNext();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show auto-advance message if in demo mode
  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={4}
        title="Demo Categories Created"
        description="Demo categories are ready with sample budgets to see how spending tracking works."
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <p className="text-muted-foreground">
            Demo categories with sample budgets are ready for you to explore.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={4}
      title="Organize Your Spending"
      description="Organize spending with auto-categorization that learns your patterns and alerts you when budgets approach limits."
      onNext={() => {}}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      hideFooter={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <FolderTree className="w-8 h-8 text-primary" />
          </div>
        </div>

        <WhyThisMatters
          benefits={[
            'Group similar expenses for easy tracking',
            'Set spending limits and get alerts when close',
            'See spending trends and patterns over time',
            'Auto-categorization learns from your habits',
          ]}
        />

        <div className="bg-elevated border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ve pre-filled an example category. Modify it or create your own spending category
            with a monthly budget.
          </p>
        </div>

        <CategoryForm
          category={{
            name: 'Groceries',
            type: 'expense',
            monthlyBudget: 500,
            isTaxDeductible: false,
            isActive: true,
          }}
          onSubmit={handleSubmit}
          onCancel={onPrevious}
          isLoading={isSubmitting}
        />

        {/* Common Categories Suggestions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium text-foreground mb-2">Common Categories:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_CATEGORIES.map((category) => (
              <span
                key={category}
                className="px-3 py-1 text-xs rounded-full bg-elevated text-muted-foreground border border-border"
              >
                {category}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            You can add more categories later from the dashboard.
          </p>
        </div>
      </div>
    </OnboardingStep>
  );
}

