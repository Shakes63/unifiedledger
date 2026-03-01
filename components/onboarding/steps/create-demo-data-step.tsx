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
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p className="font-medium" style={{ color: 'var(--color-foreground)' }}>{progress}</p>
          </>
        )}

        {result && !loading && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                Demo Data Created!
              </h3>
              <div className="rounded-lg p-4 space-y-2 text-left border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Created:</p>
                <ul className="text-sm space-y-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  <li>• {result.accountsCreated} accounts</li>
                  <li>• {result.categoriesCreated} categories</li>
                  <li>• {result.merchantsCreated} merchants</li>
                  <li>• {result.billsCreated} bills</li>
                  <li>• {result.goalsCreated} goals</li>
                  <li>• {result.debtsCreated} debt</li>
                  <li>• {result.transactionsCreated} transactions</li>
                </ul>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                All demo data is clearly marked and won&apos;t affect real household finances.
              </p>
            </div>
          </>
        )}

        {error && !loading && (
          <div className="w-full max-w-md rounded-lg p-4 border" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', borderColor: 'color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
              You can continue with onboarding anyway.
            </p>
          </div>
        )}
      </div>
    </OnboardingStep>
  );
}

