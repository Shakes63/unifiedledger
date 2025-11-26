'use client';

import { OnboardingStep } from '../onboarding-step';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useOnboarding } from '@/contexts/onboarding-context';
import { useHousehold } from '@/contexts/household-context';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { isInvitedUser, invitationHouseholdId } = useOnboarding();
  const { households } = useHousehold();
  
  // Find household name
  const invitedHousehold = households.find(h => h.id === invitationHouseholdId);
  const householdName = invitedHousehold?.name || 'the household';

  return (
    <OnboardingStep
      stepNumber={1}
      title={isInvitedUser ? `Welcome to ${householdName}!` : "Welcome to Unified Ledger!"}
      description={
        isInvitedUser
          ? "Practice with demo data before working with real finances - all demo items are clearly marked and safe to explore."
          : "Set up your finances in minutes with smart automation that learns your spending habits."
      }
      onNext={onNext}
      onPrevious={() => {}}
      isFirstStep={true}
      nextLabel="Get Started"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        {/* Demo Mode Banner */}
        {isInvitedUser && (
          <div className="w-full max-w-md bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-4">
            <p className="text-sm text-foreground font-medium">
              🎯 Demo Mode
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All data created during onboarding will be marked as "Demo" and won't affect real household finances.
            </p>
          </div>
        )}

        <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-[var(--color-primary)]" />
        </div>

        <div className="space-y-4 max-w-md">
          {isInvitedUser ? (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                We'll create demo data so you can explore:
              </h3>
              <ul className="space-y-3 text-left text-muted-foreground">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-[var(--color-primary)]">✓</span>
                  </div>
                  <span>Demo accounts, categories, and merchants</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-[var(--color-primary)]">✓</span>
                  </div>
                  <span>Sample bills, goals, and debts</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-[var(--color-primary)]">✓</span>
                  </div>
                  <span>Practice transactions to explore features</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground pt-4">
                This will only take a moment. All demo data is clearly marked and safe to explore.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                We'll walk you through setting up:
              </h3>
              
              {/* Essential Steps */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--color-primary)] uppercase tracking-wide">Getting Started</p>
                <ul className="space-y-2 text-left text-muted-foreground">
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
                    <span>Category - Organize spending</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[var(--color-primary)]">4</span>
                    </div>
                    <span>Transaction - Record your spending</span>
                  </li>
                </ul>
              </div>

              {/* Optional Steps */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Optional - Set Up Later</p>
                <ul className="space-y-2 text-left text-muted-foreground/70">
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground">+</span>
                    </div>
                    <span>Bill - Recurring payments & reminders</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground">+</span>
                    </div>
                    <span>Goal - Savings progress tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground">+</span>
                    </div>
                    <span>Debt - Payoff projections</span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground pt-4">
                The essentials take just a few minutes. Optional features can be set up anytime from the dashboard.
              </p>
            </>
          )}
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

