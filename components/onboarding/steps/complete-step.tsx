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
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>

        <div className="space-y-4 max-w-md">
          {isInvitedUser ? (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                Welcome to the Team!
              </h3>
              <p className="text-muted-foreground">
                You've successfully joined the household. You can now view shared accounts, 
                transactions, and collaborate on budgets and goals.
              </p>
            </>
          ) : demoDataCleared ? (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                Welcome to Unified Ledger!
              </h3>
              <p className="text-muted-foreground">
                You've chosen to start fresh. Create your first account and begin tracking your finances right away.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-foreground">
                Welcome to Unified Ledger!
              </h3>
              <p className="text-muted-foreground">
                You've set up the basics. Now you can start tracking your finances, managing budgets,
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
          <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
            <p className="text-sm font-medium text-foreground mb-2">What You Can Do:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>View shared accounts and their balances</li>
              <li>See transactions from all household members</li>
              <li>Track bills and upcoming payments</li>
              <li>Monitor progress on shared goals</li>
            </ul>
          </div>
        ) : demoDataCleared ? (
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
          className="mt-6 bg-primary text-background hover:opacity-90"
          size="lg"
          disabled={isLoading}
        >
          {isInvitedUser ? 'Go to Dashboard' : 'Start Using Unified Ledger'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </OnboardingStep>
  );
}

