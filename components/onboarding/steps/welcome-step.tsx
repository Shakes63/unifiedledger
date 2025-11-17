'use client';

import { OnboardingStep } from '../onboarding-step';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <OnboardingStep
      stepNumber={1}
      title="Welcome to Unified Ledger!"
      description="Let's get you started with a quick tour of the app's core features."
      onNext={onNext}
      onPrevious={() => {}}
      isFirstStep={true}
      nextLabel="Get Started"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-[var(--color-primary)]" />
        </div>

        <div className="space-y-4 max-w-md">
          <h3 className="text-xl font-semibold text-foreground">
            We'll walk you through setting up your first:
          </h3>

          <ul className="space-y-3 text-left text-muted-foreground">
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">1</span>
              </div>
              <span>Household - Organize your finances</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">2</span>
              </div>
              <span>Account - Track your money</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">3</span>
              </div>
              <span>Bill - Set up recurring payments</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">4</span>
              </div>
              <span>Goal - Plan your savings</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">5</span>
              </div>
              <span>Debt - Track what you owe</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--color-primary)]">6</span>
              </div>
              <span>Transaction - Record your spending</span>
            </li>
          </ul>

          <p className="text-sm text-muted-foreground pt-4">
            This will only take a few minutes. You can skip any step if you prefer to set it up later.
          </p>
        </div>

        <Button
          onClick={onNext}
          className="mt-6 bg-[var(--color-primary)] text-background hover:opacity-90"
          size="lg"
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}

