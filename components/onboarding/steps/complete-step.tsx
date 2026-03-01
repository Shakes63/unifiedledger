'use client';

import { OnboardingStep } from '../onboarding-step';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Home, Wallet, Receipt, Target, CreditCard, DollarSign } from 'lucide-react';
import { useOnboarding } from '@/contexts/onboarding-context';
import Link from 'next/link';

interface CompleteStepProps {
  onComplete: () => void;
  onPrevious: () => void;
  isLoading: boolean;
  demoDataCleared?: boolean;
}

export function CompleteStep({ onComplete, onPrevious, isLoading, demoDataCleared = false }: CompleteStepProps) {
  const { isInvitedUser, clearInvitationContext, totalSteps } = useOnboarding();
  
  const quickLinks = [
    { href: '/dashboard/transactions', label: 'Transactions', icon: DollarSign },
    { href: '/dashboard/accounts', label: 'Accounts', icon: Wallet },
    { href: '/dashboard/bills', label: 'Bills', icon: Receipt },
    { href: '/dashboard/goals', label: 'Goals', icon: Target },
    { href: '/dashboard/debts', label: 'Debts', icon: CreditCard },
    { href: '/dashboard', label: 'Dashboard', icon: Home },
  ];

  const handleComplete = async () => {
    // Clear invitation context after completion
    if (isInvitedUser) {
      clearInvitationContext();
    }
    await onComplete();
  };

  // Determine title and description based on user type and choice
  const getTitle = () => {
    if (isInvitedUser) return "You're All Set!";
    if (demoDataCleared) return "Fresh Start Ready!";
    return "You're All Set!";
  };

  const getDescription = () => {
    if (isInvitedUser) {
      return "Welcome to the household! You can now view shared finances and collaborate with other members.";
    }
    if (demoDataCleared) {
      return "You're starting with a clean slate. Create your first account and transaction to get started.";
    }
    return "Congratulations! You've completed the onboarding. Here's what you can do next.";
  };

  const tipItems = isInvitedUser
    ? ['View shared accounts and their balances', 'See transactions from all household members', 'Track bills and upcoming payments', 'Monitor progress on shared goals']
    : demoDataCleared
    ? ['Create your first account to track your finances', 'Add transactions to start building history', 'Set up bills for recurring expenses', 'Create savings goals to work towards']
    : ['Import transactions from CSV files', 'Set up categorization rules for automatic organization', 'Create budgets to track your spending', 'Invite family members to share households'];

  const tipTitle = isInvitedUser ? 'What You Can Do' : demoDataCleared ? 'Getting Started' : 'Pro Tips';

  return (
    <OnboardingStep
      stepNumber={totalSteps}
      title={getTitle()}
      description={getDescription()}
      onNext={handleComplete}
      onPrevious={onPrevious}
      isLastStep={true}
      isLoading={isLoading}
      nextLabel={isInvitedUser ? "Go to Dashboard" : "Start Using Unified Ledger"}
    >
      <div className="flex flex-col items-center py-6 space-y-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
          <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
        </div>

        <div className="w-full max-w-md space-y-4">
          {/* Quick Links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Quick Links</p>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(link => (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:opacity-80" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)' }}>
                      <link.icon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>{link.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl px-4 py-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-muted-foreground)' }}>{tipTitle}</p>
            <div className="space-y-2">
              {tipItems.map(item => (
                <div key={item} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)' }}>
                    <span className="text-[9px] font-bold" style={{ color: 'var(--color-success)' }}>✓</span>
                  </div>
                  <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={handleComplete} disabled={isLoading} className="h-10 px-6 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
          {isInvitedUser ? 'Go to Dashboard' : 'Start Using Unified Ledger'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}
