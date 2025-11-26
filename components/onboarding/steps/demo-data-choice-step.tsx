'use client';

import { useEffect, useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { useOnboarding } from '@/contexts/onboarding-context';
import { Loader2, Database, Sparkles, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemoDataChoiceStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onDemoDataCleared: () => void;
}

interface DemoDataSummary {
  accounts: number;
  categories: number;
  merchants: number;
  transactions: number;
  bills: number;
  goals: number;
  debts: number;
}

type Choice = 'keep' | 'clear' | null;

export function DemoDataChoiceStep({
  onNext,
  onPrevious,
  onDemoDataCleared,
}: DemoDataChoiceStepProps) {
  const { invitationHouseholdId } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [summary, setSummary] = useState<DemoDataSummary | null>(null);
  const [choice, setChoice] = useState<Choice>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch demo data summary on mount
  useEffect(() => {
    const fetchSummary = async () => {
      if (!invitationHouseholdId) {
        setError('Household ID not found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/onboarding/clear-demo-data?householdId=${invitationHouseholdId}`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch demo data summary');
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        console.error('Failed to fetch demo data summary:', err);
        setError('Failed to load demo data information');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [invitationHouseholdId]);

  const handleContinue = async () => {
    if (choice === 'keep') {
      // Just continue without clearing
      onNext();
    } else if (choice === 'clear') {
      // Clear demo data first
      await clearDemoData();
    }
  };

  const clearDemoData = async () => {
    if (!invitationHouseholdId) {
      toast.error('Household ID not found');
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/clear-demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ householdId: invitationHouseholdId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear demo data');
      }

      const result = await response.json();
      const totalDeleted =
        result.deleted.transactions +
        result.deleted.bills +
        result.deleted.goals +
        result.deleted.debts +
        result.deleted.accounts;

      toast.success(`Cleared ${totalDeleted} demo items`);
      onDemoDataCleared();
      onNext();
    } catch (err) {
      console.error('Failed to clear demo data:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear demo data');
      toast.error('Failed to clear demo data');
    } finally {
      setClearing(false);
    }
  };

  const totalDemoItems = summary
    ? summary.accounts +
      summary.categories +
      summary.transactions +
      summary.bills +
      summary.goals +
      summary.debts
    : 0;

  return (
    <OnboardingStep
      stepNumber={9}
      title="What Would You Like to Do?"
      description="You have demo data set up to help you learn the app. Choose whether to keep it or start fresh."
      onNext={handleContinue}
      onPrevious={onPrevious}
      isLoading={clearing}
      nextLabel={
        choice === 'clear'
          ? clearing
            ? 'Clearing...'
            : 'Clear & Continue'
          : 'Continue'
      }
    >
      <div className="flex flex-col space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
            <p className="mt-4 text-muted-foreground">Loading demo data info...</p>
          </div>
        ) : error && !summary ? (
          <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-xl p-4 text-center">
            <AlertCircle className="w-6 h-6 text-[var(--color-error)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              You can continue with onboarding anyway.
            </p>
          </div>
        ) : (
          <>
            {/* Choice Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Keep Demo Data */}
              <button
                type="button"
                onClick={() => setChoice('keep')}
                disabled={clearing}
                className={cn(
                  'flex flex-col items-center p-6 rounded-xl border-2 transition-all text-left',
                  'hover:border-[var(--color-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50',
                  choice === 'keep'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-border bg-card',
                  clearing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center mb-4',
                    choice === 'keep'
                      ? 'bg-[var(--color-primary)]/20'
                      : 'bg-elevated'
                  )}
                >
                  <Database
                    className={cn(
                      'w-7 h-7',
                      choice === 'keep'
                        ? 'text-[var(--color-primary)]'
                        : 'text-muted-foreground'
                    )}
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Keep Demo Data
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                  Practice with sample accounts, transactions, and bills to learn the app.
                </p>
                {choice === 'keep' && (
                  <div className="mt-4 flex items-center text-[var(--color-primary)]">
                    <Check className="w-5 h-5 mr-1" />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </button>

              {/* Start Fresh */}
              <button
                type="button"
                onClick={() => setChoice('clear')}
                disabled={clearing}
                className={cn(
                  'flex flex-col items-center p-6 rounded-xl border-2 transition-all text-left',
                  'hover:border-[var(--color-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50',
                  choice === 'clear'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-border bg-card',
                  clearing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center mb-4',
                    choice === 'clear'
                      ? 'bg-[var(--color-primary)]/20'
                      : 'bg-elevated'
                  )}
                >
                  <Sparkles
                    className={cn(
                      'w-7 h-7',
                      choice === 'clear'
                        ? 'text-[var(--color-primary)]'
                        : 'text-muted-foreground'
                    )}
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Start Fresh
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                  Clear all demo data and begin with a clean slate.
                </p>
                {choice === 'clear' && (
                  <div className="mt-4 flex items-center text-[var(--color-primary)]">
                    <Check className="w-5 h-5 mr-1" />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </button>
            </div>

            {/* Demo Data Summary */}
            {summary && totalDemoItems > 0 && (
              <div className="bg-elevated border border-border rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  Demo Data Summary:
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.accounts}
                    </span>
                    <span className="text-xs text-muted-foreground">Accounts</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.categories}
                    </span>
                    <span className="text-xs text-muted-foreground">Categories</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.transactions}
                    </span>
                    <span className="text-xs text-muted-foreground">Transactions</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.bills}
                    </span>
                    <span className="text-xs text-muted-foreground">Bills</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.goals}
                    </span>
                    <span className="text-xs text-muted-foreground">Goals</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-foreground">
                      {summary.debts}
                    </span>
                    <span className="text-xs text-muted-foreground">Debts</span>
                  </div>
                </div>
              </div>
            )}

            {/* Helpful Info */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                {choice === 'clear' ? (
                  <>
                    <span className="font-medium text-foreground">Note:</span> All demo
                    data (items prefixed with "Demo") will be permanently deleted. This
                    action cannot be undone.
                  </>
                ) : choice === 'keep' ? (
                  <>
                    <span className="font-medium text-foreground">Tip:</span> Demo data is
                    clearly marked and won't interfere with real finances. You can delete
                    it later from the settings.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">Choose an option</span>{' '}
                    to continue with onboarding.
                  </>
                )}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-xl p-4">
                <p className="text-sm text-[var(--color-error)]">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </OnboardingStep>
  );
}

