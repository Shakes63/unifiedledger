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

  const lbl = { color: 'var(--color-muted-foreground)' };

  return (
    <OnboardingStep
      stepNumber={1}
      title={isInvitedUser ? `Welcome to ${householdName}!` : "Welcome to Unified Ledger!"}
      description={
        isInvitedUser
          ? "You've been invited to join this household. Let's get you set up!"
          : "Set up your finances in minutes with smart automation that learns your spending habits."
      }
      onNext={onNext}
      onPrevious={() => {}}
      isFirstStep={true}
      nextLabel={isInvitedUser ? "Join Household" : "Get Started"}
    >
      <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
          <Sparkles className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>

        <div className="space-y-4 max-w-md w-full text-left">
          {isInvitedUser ? (
            <>
              <h3 className="text-[15px] font-semibold text-center" style={{ color: 'var(--color-foreground)' }}>
                You&apos;re joining {householdName}
              </h3>
              <div className="space-y-2">
                {['View shared accounts and transactions', 'Track bills and budgets together', 'Collaborate on financial goals'].map(item => (
                  <div key={item} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)' }}>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--color-success)' }}>✓</span>
                    </div>
                    <span className="text-[13px]" style={lbl}>{item}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>Getting Started</p>
                <div className="space-y-1.5">
                  {[
                    { n: 1, label: 'Household — Organize your finances' },
                    { n: 2, label: 'Account — Track your money' },
                    { n: 3, label: 'Category — Organize spending' },
                    { n: 4, label: 'Transaction — Record your spending' },
                  ].map(({ n, label }) => (
                    <div key={n} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>{n}</div>
                      <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={lbl}>Optional — Set Up Later</p>
                <div className="space-y-1.5">
                  {['Bill — Recurring payments & reminders', 'Goal — Savings progress tracking', 'Debt — Payoff projections'].map(label => (
                    <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>+</div>
                      <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <Button onClick={onNext} className="h-10 px-6 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
          {isInvitedUser ? 'Join Household' : 'Get Started'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}
