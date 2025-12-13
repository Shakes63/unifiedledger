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
  const { isInvitedUser, clearInvitationContext } = useOnboarding();
  
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
    if (!isInvitedUser) return "You&apos;re All Set!";
    if (demoDataCleared) return "Fresh Start Ready!";
    return "Demo Data Created!";
  };

  const getDescription = () => {
    if (!isInvitedUser) {
      return "Congratulations! You&apos;ve completed the onboarding. Here&apos;s what you can do next.";
    }
    if (demoDataCleared) {
      return "You&apos;re starting with a clean slate. Create your first account and transaction to get started.";
    }
    return "You can now explore the app with sample data. All demo data is clearly marked and won&apos;t affect real household finances.";
  };

  return (
    <OnboardingStep
      stepNumber={isInvitedUser ? 10 : 9}
      title={getTitle()}
      description={getDescription()}
      onNext={handleComplete}
      onPrevious={onPrevious}
      isLastStep={true}
      isLoading={isLoading}
      nextLabel={isInvitedUser ? "Start Exploring" : "Start Using Unified Ledger"}
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-(--color-success)/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-(--color-success)" />
        </div>

        <div className="space-y-4 max-w-md">
          {isInvitedUser ? (
            demoDataCleared ? (
              <>
                <h3 className="text-xl font-semibold text-foreground">
                  Welcome to Unified Ledger!
                </h3>
                <p className="text-muted-foreground">
                  You&apos;ve chosen to start fresh. Create your first account and begin tracking your finances right away.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-foreground">
                  Welcome to Unified Ledger!
                </h3>
                <p className="text-muted-foreground">
                  Demo data has been created so you can practice and explore the app. All demo items are clearly marked with &quot;Demo&quot; prefix.
                </p>
              </>
            )
          ) : (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                Welcome to Unified Ledger!
              </h3>
              <p className="text-muted-foreground">
                You&apos;ve set up the basics. Now you can start tracking your finances, managing budgets,
                and achieving your financial goals.
              </p>
            </>
          )}
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

        {isInvitedUser ? (
          demoDataCleared ? (
            <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
              <p className="text-sm font-medium text-foreground mb-2">Getting Started:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Create your first account to track your finances</li>
                <li>Add transactions to start building your history</li>
                <li>Set up bills for recurring expenses</li>
                <li>Create savings goals to work towards</li>
              </ul>
            </div>
          ) : (
            <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
              <p className="text-sm font-medium text-foreground mb-2">Tips for Exploring:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Try creating a transaction to see how it works</li>
                <li>Explore the dashboard to see your demo accounts and balances</li>
                <li>Check out bills, goals, and debts in their respective sections</li>
                <li>Demo data won&apos;t affect real household finances</li>
              </ul>
            </div>
          )
        ) : (
          <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
            <p className="text-sm font-medium text-foreground mb-2">Pro Tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Import transactions from CSV files</li>
              <li>Set up categorization rules for automatic organization</li>
              <li>Create budgets to track your spending</li>
              <li>Invite family members to share households</li>
            </ul>
          </div>
        )}

        <Button
          onClick={handleComplete}
          className="mt-6 bg-(--color-primary) text-background hover:opacity-90"
          size="lg"
          disabled={isLoading}
        >
          {isInvitedUser ? 'Start Exploring' : 'Start Using Unified Ledger'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}

