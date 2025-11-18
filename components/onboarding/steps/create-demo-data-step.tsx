'use client';

import { useEffect, useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { useOnboarding } from '@/contexts/onboarding-context';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDemoDataStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function CreateDemoDataStep({ onNext, onPrevious }: CreateDemoDataStepProps) {
  const { invitationHouseholdId } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Initializing...');
  const [result, setResult] = useState<{
    accountsCreated: number;
    categoriesCreated: number;
    billsCreated: number;
    goalsCreated: number;
    debtsCreated: number;
    transactionsCreated: number;
    merchantsCreated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createDemoData = async () => {
      if (!invitationHouseholdId) {
        setError('Household ID not found');
        setLoading(false);
        return;
      }

      try {
        setProgress('Creating accounts...');
        const response = await fetch('/api/onboarding/generate-demo-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ householdId: invitationHouseholdId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create demo data');
        }

        const data = await response.json();
        setResult(data);
        setProgress('Complete!');
        toast.success('Demo data created successfully');
        
        // Auto-advance after 2 seconds
        setTimeout(() => {
          onNext();
        }, 2000);
      } catch (err) {
        console.error('Failed to create demo data:', err);
        setError(err instanceof Error ? err.message : 'Failed to create demo data');
        toast.error('Failed to create demo data. You can continue anyway.');
        // Still allow user to continue
        setTimeout(() => {
          onNext();
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    createDemoData();
  }, [invitationHouseholdId, onNext]);

  return (
    <OnboardingStep
      stepNumber={2}
      title="Creating Demo Data"
      description="We're setting up some practice data so you can explore the app."
      onNext={onNext}
      onPrevious={onPrevious}
      isFirstStep={false}
      isLoading={loading}
      nextLabel="Continue"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        {loading && (
          <>
            <Loader2 className="w-12 h-12 text-[var(--color-primary)] animate-spin" />
            <p className="text-foreground font-medium">{progress}</p>
          </>
        )}

        {result && !loading && (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
            </div>
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold text-foreground">
                Demo Data Created!
              </h3>
              <div className="bg-elevated border border-border rounded-lg p-4 space-y-2 text-left">
                <p className="text-sm font-medium text-foreground mb-3">Created:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {result.accountsCreated} accounts</li>
                  <li>• {result.categoriesCreated} categories</li>
                  <li>• {result.merchantsCreated} merchants</li>
                  <li>• {result.billsCreated} bills</li>
                  <li>• {result.goalsCreated} goals</li>
                  <li>• {result.debtsCreated} debt</li>
                  <li>• {result.transactionsCreated} transactions</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                All demo data is clearly marked and won't affect real household finances.
              </p>
            </div>
          </>
        )}

        {error && !loading && (
          <div className="w-full max-w-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg p-4">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              You can continue with onboarding anyway.
            </p>
          </div>
        )}
      </div>
    </OnboardingStep>
  );
}

