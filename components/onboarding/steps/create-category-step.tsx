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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Demo categories with sample budgets are ready for you to explore.</p>
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
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <FolderTree className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>

        <WhyThisMatters benefits={['Group similar expenses for easy tracking', 'Set spending limits and get alerts when close', 'See spending trends and patterns over time', 'Auto-categorization learns from your habits']} />

        <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>We&apos;ve pre-filled an example category. Modify it or create your own spending category with a monthly budget.</p>
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

        <div className="rounded-xl px-4 py-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--color-muted-foreground)' }}>Common Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_CATEGORIES.map(cat => (
              <span key={cat} className="px-2.5 py-1 text-[11px] rounded-full" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>{cat}</span>
            ))}
          </div>
          <p className="text-[11px] mt-2.5" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>You can add more categories later from the dashboard.</p>
        </div>
      </div>
    </OnboardingStep>
  );
}

