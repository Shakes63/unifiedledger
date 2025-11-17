'use client';

import { OnboardingStep } from '../onboarding-step';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Home, Wallet, Receipt, Target, CreditCard, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface CompleteStepProps {
  onComplete: () => void;
  onPrevious: () => void;
  isLoading: boolean;
}

export function CompleteStep({ onComplete, onPrevious, isLoading }: CompleteStepProps) {
  const quickLinks = [
    { href: '/dashboard/transactions', label: 'Transactions', icon: DollarSign },
    { href: '/dashboard/accounts', label: 'Accounts', icon: Wallet },
    { href: '/dashboard/bills', label: 'Bills', icon: Receipt },
    { href: '/dashboard/goals', label: 'Goals', icon: Target },
    { href: '/dashboard/debts', label: 'Debts', icon: CreditCard },
    { href: '/dashboard', label: 'Dashboard', icon: Home },
  ];

  return (
    <OnboardingStep
      stepNumber={8}
      title="You're All Set!"
      description="Congratulations! You've completed the onboarding. Here's what you can do next."
      onNext={onComplete}
      onPrevious={onPrevious}
      isLastStep={true}
      isLoading={isLoading}
      nextLabel="Start Using Unified Ledger"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-[var(--color-success)]" />
        </div>

        <div className="space-y-4 max-w-md">
          <h3 className="text-xl font-semibold text-foreground">
            Welcome to Unified Ledger!
          </h3>
          <p className="text-muted-foreground">
            You've set up the basics. Now you can start tracking your finances, managing budgets,
            and achieving your financial goals.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <h4 className="text-sm font-semibold text-foreground text-left">
            Quick Links
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="outline"
                  className="w-full justify-start border-border text-foreground hover:bg-elevated"
                >
                  <link.icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
          <p className="text-sm font-medium text-foreground mb-2">💡 Pro Tips:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Import transactions from CSV files</li>
            <li>Set up categorization rules for automatic organization</li>
            <li>Create budgets to track your spending</li>
            <li>Invite family members to share households</li>
          </ul>
        </div>

        <Button
          onClick={onComplete}
          className="mt-6 bg-[var(--color-primary)] text-background hover:opacity-90"
          size="lg"
          disabled={isLoading}
        >
          Start Using Unified Ledger
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}

